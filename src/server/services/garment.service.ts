import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  checklistItems,
  checklists,
  garmentPhotos,
  garments,
  garmentWorkflowStages,
  handoverRecords,
  issueReports,
  orders,
  systemSettings,
  users,
  workflowHistory,
  workflowTemplates,
  workflowTemplateStages,
} from '../../db/schema.ts';
import type {
  GarmentStatus,
  OperationalDepartment,
  PhotoType,
  RoleCode,
  TagStatus,
} from '../../shared/types.ts';
import { AppError } from '../errors/app-error.ts';
import { detectImageMimeFromBuffer } from '../utils/crypto.ts';
import { writeAuditLog } from './audit.service.ts';
import { deletePhotoObjects, uploadGarmentPhotoBuffers } from './storage.service.ts';
import { WAITING_STATUS_BY_DEPT } from './workflow.rules.ts';

type ChecklistTemplateItem = { key: string; label: string };

const DEFAULT_CHECKLISTS: Record<OperationalDepartment, ChecklistTemplateItem[]> = {
  SPOTTING: [
    { key: 'tag_match', label: 'Nomor tag fisik & detail barang sesuai catatan' },
    { key: 'stain_assessed', label: 'Jenis noda & risiko kerusakan serat telah diperiksa' },
    { key: 'treatment_done', label: 'Proses spotting selesai tanpa merusak bahan' },
    { key: 'hardware_checked', label: 'Kancing, ritsleting, dan aksesoris dalam kondisi aman' },
  ],
  IRONING: [
    { key: 'tag_match', label: 'Identitas barang & tag fisik terverifikasi' },
    { key: 'temp_matched', label: 'Suhu setrika/steamer sesuai label perawatan bahan' },
    { key: 'finish_checked', label: 'Tidak ada lipatan berlebih atau kilap setrika' },
    { key: 'visual_clean', label: 'Tidak ada noda tertinggal setelah pemanasan' },
  ],
  PACKING: [
    { key: 'tag_match', label: 'Identitas barang, pelanggan/vendor, & tag terverifikasi' },
    { key: 'final_qc', label: 'Kualitas kebersihan dan kerapian akhir lolos QC' },
    { key: 'scent_cover', label: 'Gantungan/lipatan & pelindung debu terpasang rapi' },
    { key: 'ready_label', label: 'Barang siap ditempatkan di rak pengambilan' },
  ],
};

async function getChecklistTemplatesMap(): Promise<
  Record<OperationalDepartment, ChecklistTemplateItem[]>
> {
  const row = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'checklist_templates'))
    .limit(1);
  if (!row.length || typeof row[0].value !== 'object' || row[0].value === null) {
    return DEFAULT_CHECKLISTS;
  }
  return {
    ...DEFAULT_CHECKLISTS,
    ...(row[0].value as Partial<Record<OperationalDepartment, ChecklistTemplateItem[]>>),
  };
}

export async function listWorkflowTemplates() {
  const templates = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.isActive, true))
    .orderBy(workflowTemplates.name);

  const stages = await db
    .select()
    .from(workflowTemplateStages)
    .orderBy(asc(workflowTemplateStages.stageOrder));

  return templates.map((t) => ({
    ...t,
    stages: stages.filter((s) => s.templateId === t.id),
  }));
}

export async function registerGarment(params: {
  actorUserId: string;
  orderId: string;
  templateCode: string;
  garmentName: string;
  category: string;
  garmentType: string;
  brand?: string | null;
  color: string;
  size?: string | null;
  physicalTagNumber: string;
  distinctiveFeatures?: string | null;
  initialCondition: string;
  stainDescription?: string | null;
  specialInstructions?: string | null;
  ipAddress?: string;
}) {
  const orderRows = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!orderRows.length) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.');
  }
  const order = orderRows[0];
  if (order.status === 'ARCHIVED' || order.status === 'CANCELLED') {
    throw new AppError(
      409,
      'ORDER_CLOSED',
      'Tidak dapat mendaftarkan barang ke pesanan yang sudah diarsipkan atau dibatalkan.'
    );
  }

  const templateRows = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.code, params.templateCode))
    .limit(1);
  if (!templateRows.length) {
    throw new AppError(400, 'INVALID_TEMPLATE', 'Template alur layanan tidak valid.');
  }
  const template = templateRows[0];

  const templateStages = await db
    .select()
    .from(workflowTemplateStages)
    .where(eq(workflowTemplateStages.templateId, template.id))
    .orderBy(asc(workflowTemplateStages.stageOrder));

  if (!templateStages.length) {
    throw new AppError(400, 'EMPTY_TEMPLATE_STAGES', 'Template layanan belum memiliki tahapan divisi.');
  }

  // Warn / prevent duplicate physical tag among currently active garments
  const activeTagConflict = await db
    .select({ id: garments.id, garmentCode: garments.garmentCode })
    .from(garments)
    .where(
      and(
        eq(garments.physicalTagNumber, params.physicalTagNumber.trim()),
        isNull(garments.deletedAt),
        inArray(garments.currentStatus, [
          'REGISTERED',
          'WAITING_SPOTTING',
          'SPOTTING_IN_PROGRESS',
          'WAITING_IRONING',
          'IRONING_IN_PROGRESS',
          'WAITING_PACKING',
          'PACKING_IN_PROGRESS',
          'READY_FOR_PICKUP',
          'ON_HOLD',
        ])
      )
    )
    .limit(1);

  if (activeTagConflict.length) {
    throw new AppError(
      409,
      'DUPLICATE_ACTIVE_TAG',
      `Nomor tag fisik "${params.physicalTagNumber.trim()}" sedang digunakan oleh barang aktif (${activeTagConflict[0].garmentCode}).`
    );
  }

  const existingCountRows = await db
    .select({ total: count() })
    .from(garments)
    .where(eq(garments.orderId, order.id));
  const seq = Number(existingCountRows[0].total) + 1;
  const suffix = order.orderCode.replace(/^ALM-/, '');
  const garmentCode = `GRM-${suffix}-${String(seq).padStart(2, '0')}`;

  const firstStage = templateStages[0];
  const firstDept = firstStage.department as OperationalDepartment;
  const firstStatus = WAITING_STATUS_BY_DEPT[firstDept];
  const checklistMap = await getChecklistTemplatesMap();

  const created = await db.transaction(async (tx) => {
    const now = new Date();
    const defaultDue =
      order.expectedCompletionAt ??
      new Date(now.getTime() + templateStages.reduce((acc, s) => acc + s.slaHours, 0) * 3600000);

    const [inserted] = await tx
      .insert(garments)
      .values({
        garmentCode,
        orderId: order.id,
        templateId: template.id,
        garmentName: params.garmentName.trim(),
        category: params.category.trim(),
        garmentType: params.garmentType.trim(),
        brand: params.brand?.trim() || null,
        color: params.color.trim(),
        size: params.size?.trim() || null,
        physicalTagNumber: params.physicalTagNumber.trim(),
        tagStatus: 'ATTACHED',
        distinctiveFeatures: params.distinctiveFeatures?.trim() || null,
        initialCondition: params.initialCondition.trim(),
        stainDescription: params.stainDescription?.trim() || null,
        specialInstructions: params.specialInstructions?.trim() || null,
        currentDepartment: firstDept,
        currentStatus: firstStatus,
        dueAt: defaultDue,
        registeredBy: params.actorUserId,
      })
      .returning();

    // Instantiate per-garment workflow stages + checklists
    let cumulativeHours = 0;
    for (const ts of templateStages) {
      cumulativeHours += ts.slaHours;
      const stageDept = ts.department as OperationalDepartment;
      const [stageRow] = await tx
        .insert(garmentWorkflowStages)
        .values({
          garmentId: inserted.id,
          department: stageDept,
          stageOrder: ts.stageOrder,
          status: 'PENDING',
          dueAt: new Date(now.getTime() + cumulativeHours * 3600000),
        })
        .returning();

      const [checklistRow] = await tx
        .insert(checklists)
        .values({
          garmentId: inserted.id,
          stageId: stageRow.id,
          department: stageDept,
          identityVerified: false,
          verificationMethod: 'PHYSICAL_TAG',
          isComplete: false,
        })
        .returning();

      const items = checklistMap[stageDept] ?? [];
      if (items.length) {
        await tx.insert(checklistItems).values(
          items.map((item, idx) => ({
            checklistId: checklistRow.id,
            itemKey: item.key,
            label: item.label,
            sortOrder: idx + 1,
            isChecked: false,
          }))
        );
      }
    }

    // Record REGISTERED -> WAITING_<FIRST_DEPT> transitions in workflow_history
    await tx.insert(workflowHistory).values([
      {
        garmentId: inserted.id,
        previousStatus: 'NEW',
        newStatus: 'REGISTERED',
        fromDepartment: 'ADMIN',
        toDepartment: 'ADMIN',
        performedBy: params.actorUserId,
        notes: `Registrasi barang oleh Admin (Tag fisik: ${inserted.physicalTagNumber})`,
      },
      {
        garmentId: inserted.id,
        previousStatus: 'REGISTERED',
        newStatus: firstStatus,
        fromDepartment: 'ADMIN',
        toDepartment: firstDept,
        performedBy: params.actorUserId,
        notes: `Masuk antrean divisi ${firstDept} (${template.name})`,
      },
    ]);

    // If order was READY_FOR_PICKUP and a new garment is added, return order to ACTIVE
    if (order.status === 'READY_FOR_PICKUP') {
      await tx
        .update(orders)
        .set({ status: 'ACTIVE', updatedAt: now })
        .where(eq(orders.id, order.id));
    }

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'GARMENT_REGISTERED',
      entityType: 'GARMENT',
      entityId: inserted.id,
      metadata: {
        garmentCode: inserted.garmentCode,
        orderId: order.id,
        physicalTagNumber: inserted.physicalTagNumber,
        templateCode: template.code,
      },
      ipAddress: params.ipAddress,
    });

    return inserted;
  });

  return created;
}

export async function listGarments(params: {
  page: number;
  perPage: number;
  search?: string;
  status?: GarmentStatus;
  department?: string;
  orderId?: string;
  includeArchived?: boolean;
  actorRole: RoleCode;
}) {
  const offset = (params.page - 1) * params.perPage;
  const filters = [isNull(garments.deletedAt)];

  // Staff roles default to viewing active workflow items (or their department queue)
  if (!params.includeArchived && !params.orderId && !params.status) {
    filters.push(
      inArray(garments.currentStatus, [
        'REGISTERED',
        'WAITING_SPOTTING',
        'SPOTTING_IN_PROGRESS',
        'WAITING_IRONING',
        'IRONING_IN_PROGRESS',
        'WAITING_PACKING',
        'PACKING_IN_PROGRESS',
        'READY_FOR_PICKUP',
        'ON_HOLD',
      ])
    );
  }

  if (params.status) {
    filters.push(eq(garments.currentStatus, params.status));
  }
  if (params.department) {
    filters.push(eq(garments.currentDepartment, params.department));
  }
  if (params.orderId) {
    filters.push(eq(garments.orderId, params.orderId));
  }

  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    filters.push(
      or(
        ilike(garments.garmentCode, q),
        ilike(garments.physicalTagNumber, q),
        ilike(garments.garmentName, q),
        ilike(garments.garmentType, q),
        ilike(garments.brand, q),
        ilike(garments.color, q),
        ilike(garments.distinctiveFeatures, q),
        ilike(orders.customerName, q),
        ilike(orders.orderCode, q)
      )!
    );
  }

  const whereClause = and(...filters);

  const [{ total }] = await db
    .select({ total: count() })
    .from(garments)
    .innerJoin(orders, eq(garments.orderId, orders.id))
    .where(whereClause);

  const rows = await db
    .select({
      garment: garments,
      orderCode: orders.orderCode,
      customerName: orders.customerName,
      orderCategory: orders.orderCategory,
      templateName: workflowTemplates.name,
    })
    .from(garments)
    .innerJoin(orders, eq(garments.orderId, orders.id))
    .innerJoin(workflowTemplates, eq(garments.templateId, workflowTemplates.id))
    .where(whereClause)
    .orderBy(desc(garments.createdAt))
    .limit(params.perPage)
    .offset(offset);

  // Fetch first active photo thumbnail per garment in one batched query
  const garmentIds = rows.map((r) => r.garment.id);
  const thumbMap = new Map<string, string>();
  if (garmentIds.length) {
    const photoRows = await db
      .select({
        id: garmentPhotos.id,
        garmentId: garmentPhotos.garmentId,
        photoType: garmentPhotos.photoType,
      })
      .from(garmentPhotos)
      .where(and(inArray(garmentPhotos.garmentId, garmentIds), isNull(garmentPhotos.deletedAt)))
      .orderBy(garmentPhotos.createdAt);

    for (const p of photoRows) {
      if (!thumbMap.has(p.garmentId) || p.photoType === 'FRONT') {
        thumbMap.set(p.garmentId, `/api/v1/photos/${p.id}/file?variant=thumb`);
      }
    }
  }

  return {
    items: rows.map((r) => ({
      ...r.garment,
      orderCode: r.orderCode,
      customerName: r.customerName,
      orderCategory: r.orderCategory,
      templateName: r.templateName,
      thumbnailUrl: thumbMap.get(r.garment.id) ?? null,
    })),
    meta: {
      page: params.page,
      perPage: params.perPage,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / params.perPage)),
    },
  };
}

export async function getGarmentById(garmentId: string) {
  const rows = await db
    .select({
      garment: garments,
      order: orders,
      template: workflowTemplates,
      registrantName: users.fullName,
    })
    .from(garments)
    .innerJoin(orders, eq(garments.orderId, orders.id))
    .innerJoin(workflowTemplates, eq(garments.templateId, workflowTemplates.id))
    .innerJoin(users, eq(garments.registeredBy, users.id))
    .where(and(eq(garments.id, garmentId), isNull(garments.deletedAt)))
    .limit(1);

  if (!rows.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }

  const [stages, photos, history, issues, handovers, garmentChecklists] = await Promise.all([
    db
      .select()
      .from(garmentWorkflowStages)
      .where(eq(garmentWorkflowStages.garmentId, garmentId))
      .orderBy(asc(garmentWorkflowStages.stageOrder)),
    db
      .select({
        photo: garmentPhotos,
        uploadedByName: users.fullName,
      })
      .from(garmentPhotos)
      .innerJoin(users, eq(garmentPhotos.uploadedBy, users.id))
      .where(and(eq(garmentPhotos.garmentId, garmentId), isNull(garmentPhotos.deletedAt)))
      .orderBy(desc(garmentPhotos.createdAt)),
    db
      .select({
        history: workflowHistory,
        performedByName: users.fullName,
      })
      .from(workflowHistory)
      .innerJoin(users, eq(workflowHistory.performedBy, users.id))
      .where(eq(workflowHistory.garmentId, garmentId))
      .orderBy(asc(workflowHistory.createdAt)),
    db
      .select({
        issue: issueReports,
        reportedByName: users.fullName,
      })
      .from(issueReports)
      .innerJoin(users, eq(issueReports.reportedBy, users.id))
      .where(eq(issueReports.garmentId, garmentId))
      .orderBy(desc(issueReports.createdAt)),
    db
      .select({
        handover: handoverRecords,
        handedOverByName: users.fullName,
      })
      .from(handoverRecords)
      .innerJoin(users, eq(handoverRecords.handedOverBy, users.id))
      .where(eq(handoverRecords.garmentId, garmentId))
      .orderBy(asc(handoverRecords.handedOverAt)),
    db
      .select()
      .from(checklists)
      .where(eq(checklists.garmentId, garmentId)),
  ]);

  const checklistIds = garmentChecklists.map((c) => c.id);
  const allItems = checklistIds.length
    ? await db
        .select()
        .from(checklistItems)
        .where(inArray(checklistItems.checklistId, checklistIds))
        .orderBy(asc(checklistItems.sortOrder))
    : [];

  return {
    ...rows[0].garment,
    orderCode: rows[0].order.orderCode,
    customerName: rows[0].order.customerName,
    customerPhone: rows[0].order.customerPhone,
    orderCategory: rows[0].order.orderCategory,
    orderStatus: rows[0].order.status,
    templateCode: rows[0].template.code,
    templateName: rows[0].template.name,
    registrantName: rows[0].registrantName,
    stages,
    photos: photos.map((p) => ({
      ...p.photo,
      uploadedByName: p.uploadedByName,
      thumbnailUrl: `/api/v1/photos/${p.photo.id}/file?variant=thumb`,
      originalUrl: `/api/v1/photos/${p.photo.id}/file?variant=original`,
    })),
    history: history.map((h) => ({
      ...h.history,
      performedByName: h.performedByName,
    })),
    issues: issues.map((i) => ({
      ...i.issue,
      reportedByName: i.reportedByName,
    })),
    handovers: handovers.map((h) => ({
      ...h.handover,
      handedOverByName: h.handedOverByName,
    })),
    checklists: garmentChecklists.map((c) => ({
      ...c,
      items: allItems.filter((item) => item.checklistId === c.id),
    })),
  };
}

export async function updateGarmentDetails(params: {
  actorUserId: string;
  garmentId: string;
  version: number;
  garmentName?: string;
  category?: string;
  garmentType?: string;
  brand?: string | null;
  color?: string;
  size?: string | null;
  physicalTagNumber?: string;
  tagStatus?: TagStatus;
  distinctiveFeatures?: string | null;
  initialCondition?: string;
  stainDescription?: string | null;
  specialInstructions?: string | null;
  ipAddress?: string;
}) {
  const existing = await db
    .select()
    .from(garments)
    .where(and(eq(garments.id, params.garmentId), isNull(garments.deletedAt)))
    .limit(1);

  if (!existing.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }

  if (existing[0].currentStatus === 'PICKED_UP') {
    throw new AppError(409, 'GARMENT_ARCHIVED', 'Barang yang sudah diambil tidak dapat diubah.');
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(garments)
      .set({
        ...(params.garmentName !== undefined ? { garmentName: params.garmentName.trim() } : {}),
        ...(params.category !== undefined ? { category: params.category.trim() } : {}),
        ...(params.garmentType !== undefined ? { garmentType: params.garmentType.trim() } : {}),
        ...(params.brand !== undefined ? { brand: params.brand?.trim() || null } : {}),
        ...(params.color !== undefined ? { color: params.color.trim() } : {}),
        ...(params.size !== undefined ? { size: params.size?.trim() || null } : {}),
        ...(params.physicalTagNumber !== undefined
          ? { physicalTagNumber: params.physicalTagNumber.trim() }
          : {}),
        ...(params.tagStatus !== undefined ? { tagStatus: params.tagStatus } : {}),
        ...(params.distinctiveFeatures !== undefined
          ? { distinctiveFeatures: params.distinctiveFeatures?.trim() || null }
          : {}),
        ...(params.initialCondition !== undefined
          ? { initialCondition: params.initialCondition.trim() }
          : {}),
        ...(params.stainDescription !== undefined
          ? { stainDescription: params.stainDescription?.trim() || null }
          : {}),
        ...(params.specialInstructions !== undefined
          ? { specialInstructions: params.specialInstructions?.trim() || null }
          : {}),
        version: existing[0].version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(garments.id, params.garmentId), eq(garments.version, params.version)))
      .returning();

    if (!row) {
      throw new AppError(
        409,
        'CONFLICT_OPTIMISTIC_LOCK',
        'Data barang baru saja diperbarui oleh staf lain. Muat ulang halaman.'
      );
    }

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action:
        params.physicalTagNumber && params.physicalTagNumber !== existing[0].physicalTagNumber
          ? 'PHYSICAL_TAG_UPDATED'
          : 'GARMENT_UPDATED',
      entityType: 'GARMENT',
      entityId: row.id,
      metadata: {
        previousTag: existing[0].physicalTagNumber,
        newTag: row.physicalTagNumber,
        tagStatus: row.tagStatus,
      },
      ipAddress: params.ipAddress,
    });

    return row;
  });

  return updated;
}

export async function addGarmentPhoto(params: {
  actorUserId: string;
  garmentId: string;
  photoType: PhotoType;
  caption?: string | null;
  originalBuffer: Buffer;
  thumbnailBuffer?: Buffer;
  ipAddress?: string;
}) {
  const existing = await db
    .select({ id: garments.id, currentStatus: garments.currentStatus })
    .from(garments)
    .where(and(eq(garments.id, params.garmentId), isNull(garments.deletedAt)))
    .limit(1);

  if (!existing.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }
  if (existing[0].currentStatus === 'PICKED_UP') {
    throw new AppError(409, 'GARMENT_ARCHIVED', 'Tidak dapat mengunggah foto ke barang yang sudah diambil.');
  }

  const detectedMime = detectImageMimeFromBuffer(params.originalBuffer);
  if (!detectedMime) {
    throw new AppError(
      400,
      'INVALID_IMAGE_FILE',
      'Format file foto harus berupa gambar JPEG, PNG, atau WebP yang valid.'
    );
  }

  let thumbBuffer = params.originalBuffer;
  let thumbMime: string = detectedMime;
  if (params.thumbnailBuffer && params.thumbnailBuffer.length > 12) {
    const detectedThumbMime = detectImageMimeFromBuffer(params.thumbnailBuffer);
    if (detectedThumbMime) {
      thumbBuffer = params.thumbnailBuffer;
      thumbMime = detectedThumbMime;
    }
  }

  const stored = await uploadGarmentPhotoBuffers({
    garmentId: params.garmentId,
    originalBuffer: params.originalBuffer,
    originalMime: detectedMime,
    thumbnailBuffer: thumbBuffer,
    thumbnailMime: thumbMime,
  });

  try {
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(garmentPhotos)
        .values({
          garmentId: params.garmentId,
          photoType: params.photoType,
          storageProvider: stored.storageProvider,
          storagePath: stored.storagePath,
          thumbnailPath: stored.thumbnailPath,
          mimeType: detectedMime,
          fileSizeBytes: params.originalBuffer.length,
          caption: params.caption?.trim() || null,
          uploadedBy: params.actorUserId,
        })
        .returning();

      await writeAuditLog(tx, {
        actorUserId: params.actorUserId,
        action: 'GARMENT_PHOTO_UPLOADED',
        entityType: 'GARMENT_PHOTO',
        entityId: row.id,
        metadata: { garmentId: params.garmentId, photoType: params.photoType, bytes: row.fileSizeBytes },
        ipAddress: params.ipAddress,
      });

      return row;
    });

    return {
      ...inserted,
      thumbnailUrl: `/api/v1/photos/${inserted.id}/file?variant=thumb`,
      originalUrl: `/api/v1/photos/${inserted.id}/file?variant=original`,
    };
  } catch (err) {
    await deletePhotoObjects(stored).catch(() => {});
    throw err;
  }
}

export async function listPhotosGallery(params: {
  page: number;
  perPage: number;
  photoType?: PhotoType;
  search?: string;
  garmentId?: string;
}) {
  const offset = (params.page - 1) * params.perPage;
  const filters = [isNull(garmentPhotos.deletedAt), isNull(garments.deletedAt)];

  if (params.photoType) {
    filters.push(eq(garmentPhotos.photoType, params.photoType));
  }
  if (params.garmentId) {
    filters.push(eq(garmentPhotos.garmentId, params.garmentId));
  }
  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    filters.push(
      or(
        ilike(garments.garmentCode, q),
        ilike(garments.physicalTagNumber, q),
        ilike(garments.garmentName, q),
        ilike(garments.brand, q),
        ilike(orders.customerName, q),
        ilike(orders.orderCode, q)
      )!
    );
  }

  const whereClause = and(...filters);
  const [{ total }] = await db
    .select({ total: count() })
    .from(garmentPhotos)
    .innerJoin(garments, eq(garmentPhotos.garmentId, garments.id))
    .innerJoin(orders, eq(garments.orderId, orders.id))
    .where(whereClause);

  const rows = await db
    .select({
      photo: garmentPhotos,
      garmentCode: garments.garmentCode,
      garmentName: garments.garmentName,
      physicalTagNumber: garments.physicalTagNumber,
      color: garments.color,
      brand: garments.brand,
      currentStatus: garments.currentStatus,
      orderCode: orders.orderCode,
      customerName: orders.customerName,
      uploadedByName: users.fullName,
    })
    .from(garmentPhotos)
    .innerJoin(garments, eq(garmentPhotos.garmentId, garments.id))
    .innerJoin(orders, eq(garments.orderId, orders.id))
    .innerJoin(users, eq(garmentPhotos.uploadedBy, users.id))
    .where(whereClause)
    .orderBy(desc(garmentPhotos.createdAt))
    .limit(params.perPage)
    .offset(offset);

  return {
    items: rows.map((r) => ({
      ...r.photo,
      garmentCode: r.garmentCode,
      garmentName: r.garmentName,
      physicalTagNumber: r.physicalTagNumber,
      color: r.color,
      brand: r.brand,
      currentStatus: r.currentStatus,
      orderCode: r.orderCode,
      customerName: r.customerName,
      uploadedByName: r.uploadedByName,
      thumbnailUrl: `/api/v1/photos/${r.photo.id}/file?variant=thumb`,
      originalUrl: `/api/v1/photos/${r.photo.id}/file?variant=original`,
    })),
    meta: {
      page: params.page,
      perPage: params.perPage,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / params.perPage)),
    },
  };
}

export async function softDeletePhoto(params: {
  actorUserId: string;
  photoId: string;
  ipAddress?: string;
}) {
  const rows = await db
    .select()
    .from(garmentPhotos)
    .where(and(eq(garmentPhotos.id, params.photoId), isNull(garmentPhotos.deletedAt)))
    .limit(1);

  if (!rows.length) {
    throw new AppError(404, 'PHOTO_NOT_FOUND', 'Foto tidak ditemukan.');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(garmentPhotos)
      .set({ deletedAt: new Date(), deletedBy: params.actorUserId })
      .where(eq(garmentPhotos.id, params.photoId));

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'PHOTO_DELETED',
      entityType: 'GARMENT_PHOTO',
      entityId: params.photoId,
      metadata: { garmentId: rows[0].garmentId, photoType: rows[0].photoType },
      ipAddress: params.ipAddress,
    });
  });
}

export async function getPhotoMetadata(photoId: string) {
  const rows = await db
    .select()
    .from(garmentPhotos)
    .where(and(eq(garmentPhotos.id, photoId), isNull(garmentPhotos.deletedAt)))
    .limit(1);

  if (!rows.length) {
    throw new AppError(404, 'PHOTO_NOT_FOUND', 'Foto tidak ditemukan.');
  }
  return rows[0];
}

export async function getGarmentHistory(garmentId: string) {
  const existing = await db
    .select({ id: garments.id })
    .from(garments)
    .where(and(eq(garments.id, garmentId), isNull(garments.deletedAt)))
    .limit(1);
  if (!existing.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }

  const [historyRows, handoverRows, issueRows] = await Promise.all([
    db
      .select({
        history: workflowHistory,
        performedByName: users.fullName,
      })
      .from(workflowHistory)
      .innerJoin(users, eq(workflowHistory.performedBy, users.id))
      .where(eq(workflowHistory.garmentId, garmentId))
      .orderBy(asc(workflowHistory.createdAt)),
    db
      .select({
        handover: handoverRecords,
        handedOverByName: users.fullName,
      })
      .from(handoverRecords)
      .innerJoin(users, eq(handoverRecords.handedOverBy, users.id))
      .where(eq(handoverRecords.garmentId, garmentId))
      .orderBy(asc(handoverRecords.handedOverAt)),
    db
      .select({
        issue: issueReports,
        reportedByName: users.fullName,
      })
      .from(issueReports)
      .innerJoin(users, eq(issueReports.reportedBy, users.id))
      .where(eq(issueReports.garmentId, garmentId))
      .orderBy(desc(issueReports.createdAt)),
  ]);

  return {
    history: historyRows.map((h) => ({ ...h.history, performedByName: h.performedByName })),
    handovers: handoverRows.map((h) => ({ ...h.handover, handedOverByName: h.handedOverByName })),
    issues: issueRows.map((i) => ({ ...i.issue, reportedByName: i.reportedByName })),
  };
}
