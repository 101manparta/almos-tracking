import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
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
  users,
  workflowHistory,
} from '../../db/schema.ts';
import type {
  Department,
  GarmentStatus,
  IssueSeverity,
  IssueType,
  OperationalDepartment,
  RoleCode,
} from '../../shared/types.ts';
import { AppError } from '../errors/app-error.ts';
import { writeAuditLog } from './audit.service.ts';
import {
  assertDepartmentRole,
  canCompleteStage,
  canPlaceOnHold,
  canResumeFromHold,
  canStartStage,
  IN_PROGRESS_STATUS_BY_DEPT,
  resolveNextWorkflowTarget,
} from './workflow.rules.ts';

export async function getStaffDepartmentQueue(params: {
  department: OperationalDepartment;
  statusFilter?: 'WAITING' | 'IN_PROGRESS' | 'ON_HOLD' | 'ALL';
}) {
  const waitingStatus = `WAITING_${params.department}`;
  const inProgressStatus = `${params.department}_IN_PROGRESS`;

  const statusList: string[] =
    params.statusFilter === 'WAITING'
      ? [waitingStatus]
      : params.statusFilter === 'IN_PROGRESS'
      ? [inProgressStatus]
      : params.statusFilter === 'ON_HOLD'
      ? ['ON_HOLD']
      : [waitingStatus, inProgressStatus, 'ON_HOLD'];

  const rows = await db
    .select({
      garment: garments,
      orderCode: orders.orderCode,
      customerName: orders.customerName,
      orderCategory: orders.orderCategory,
    })
    .from(garments)
    .innerJoin(orders, eq(garments.orderId, orders.id))
    .where(
      and(
        isNull(garments.deletedAt),
        eq(garments.currentDepartment, params.department),
        inArray(garments.currentStatus, statusList)
      )
    )
    .orderBy(asc(garments.dueAt), asc(garments.createdAt));

  const garmentIds = rows.map((r) => r.garment.id);
  const thumbMap = new Map<string, string>();
  if (garmentIds.length) {
    const photos = await db
      .select({
        id: garmentPhotos.id,
        garmentId: garmentPhotos.garmentId,
        photoType: garmentPhotos.photoType,
      })
      .from(garmentPhotos)
      .where(and(inArray(garmentPhotos.garmentId, garmentIds), isNull(garmentPhotos.deletedAt)));
    for (const p of photos) {
      if (!thumbMap.has(p.garmentId) || p.photoType === 'FRONT') {
        thumbMap.set(p.garmentId, `/api/v1/photos/${p.id}/file?variant=thumb`);
      }
    }
  }

  return rows.map((r) => ({
    ...r.garment,
    orderCode: r.orderCode,
    customerName: r.customerName,
    orderCategory: r.orderCategory,
    thumbnailUrl: thumbMap.get(r.garment.id) ?? null,
  }));
}

export async function startGarmentStage(params: {
  actorUserId: string;
  actorRole: RoleCode;
  garmentId: string;
  version: number;
  verificationMethod: 'PHYSICAL_TAG' | 'PHOTO_AND_DETAILS_BACKUP';
  notes?: string | null;
  ipAddress?: string;
}) {
  const garmentRows = await db
    .select()
    .from(garments)
    .where(and(eq(garments.id, params.garmentId), isNull(garments.deletedAt)))
    .limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }
  const garment = garmentRows[0];

  if (
    garment.currentDepartment !== 'SPOTTING' &&
    garment.currentDepartment !== 'IRONING' &&
    garment.currentDepartment !== 'PACKING'
  ) {
    throw new AppError(
      409,
      'INVALID_DEPARTMENT_STAGE',
      `Barang saat ini berada di ${garment.currentDepartment}, bukan antrean pengerjaan staf.`
    );
  }

  const stageDept = garment.currentDepartment as OperationalDepartment;
  const nextStatus = canStartStage({
    currentStatus: garment.currentStatus as GarmentStatus,
    currentDepartment: garment.currentDepartment as Department,
    stageDepartment: stageDept,
    actorRole: params.actorRole,
  });

  if (garment.tagStatus === 'MISSING' && params.verificationMethod === 'PHYSICAL_TAG') {
    throw new AppError(
      422,
      'BACKUP_VERIFICATION_REQUIRED',
      'Tag fisik tercatat hilang. Gunakan verifikasi foto referensi dan detail barang sebelum memulai.'
    );
  }

  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(garments)
      .set({
        currentStatus: nextStatus,
        assignedStaffId: params.actorUserId,
        version: garment.version + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(garments.id, garment.id),
          eq(garments.version, params.version),
          eq(garments.currentStatus, garment.currentStatus)
        )
      )
      .returning();

    if (!row) {
      throw new AppError(
        409,
        'CONFLICT_OPTIMISTIC_LOCK',
        'Barang sudah mulai diproses oleh staf lain atau data telah berubah. Muat ulang antrean.'
      );
    }

    const [stageRow] = await tx
      .update(garmentWorkflowStages)
      .set({
        status: 'IN_PROGRESS',
        assignedTo: params.actorUserId,
        startedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(garmentWorkflowStages.garmentId, garment.id),
          eq(garmentWorkflowStages.department, stageDept)
        )
      )
      .returning();

    if (stageRow) {
      await tx
        .update(checklists)
        .set({
          identityVerified: true,
          verificationMethod: params.verificationMethod,
          updatedAt: now,
        })
        .where(eq(checklists.stageId, stageRow.id));
    }

    // Mark any open incoming handover record as received
    await tx
      .update(handoverRecords)
      .set({ receivedBy: params.actorUserId, receivedAt: now })
      .where(
        and(
          eq(handoverRecords.garmentId, garment.id),
          eq(handoverRecords.toDepartment, stageDept),
          isNull(handoverRecords.receivedAt)
        )
      );

    await tx.insert(workflowHistory).values({
      garmentId: garment.id,
      previousStatus: garment.currentStatus,
      newStatus: nextStatus,
      fromDepartment: stageDept,
      toDepartment: stageDept,
      performedBy: params.actorUserId,
      notes:
        params.notes?.trim() ||
        `Pekerjaan divisi ${stageDept} dimulai (Verifikasi: ${params.verificationMethod})`,
    });

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'WORKFLOW_STAGE_STARTED',
      entityType: 'GARMENT',
      entityId: garment.id,
      metadata: { department: stageDept, verificationMethod: params.verificationMethod },
      ipAddress: params.ipAddress,
    });

    return row;
  });

  return updated;
}

export async function getGarmentCurrentChecklist(garmentId: string, actorRole: RoleCode) {
  const garmentRows = await db
    .select()
    .from(garments)
    .where(and(eq(garments.id, garmentId), isNull(garments.deletedAt)))
    .limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }
  const garment = garmentRows[0];

  const allChecklists = await db
    .select()
    .from(checklists)
    .where(eq(checklists.garmentId, garmentId));

  const checklistIds = allChecklists.map((c) => c.id);
  const items = checklistIds.length
    ? await db
        .select()
        .from(checklistItems)
        .where(inArray(checklistItems.checklistId, checklistIds))
        .orderBy(asc(checklistItems.sortOrder))
    : [];

  const enriched = allChecklists.map((c) => ({
    ...c,
    items: items.filter((i) => i.checklistId === c.id),
  }));

  if (actorRole === 'ADMIN') {
    return enriched;
  }
  return enriched.filter((c) => c.department === actorRole);
}

export async function saveGarmentChecklist(params: {
  actorUserId: string;
  actorRole: RoleCode;
  garmentId: string;
  identityVerified: boolean;
  verificationMethod: 'PHYSICAL_TAG' | 'PHOTO_AND_DETAILS_BACKUP';
  items: Array<{ itemKey: string; isChecked: boolean; note?: string | null }>;
  ipAddress?: string;
}) {
  const garmentRows = await db
    .select()
    .from(garments)
    .where(and(eq(garments.id, params.garmentId), isNull(garments.deletedAt)))
    .limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }
  const garment = garmentRows[0];

  if (
    garment.currentDepartment !== 'SPOTTING' &&
    garment.currentDepartment !== 'IRONING' &&
    garment.currentDepartment !== 'PACKING'
  ) {
    throw new AppError(409, 'INVALID_STAGE', 'Barang tidak sedang berada di divisi operasional.');
  }
  const dept = garment.currentDepartment as OperationalDepartment;
  assertDepartmentRole(params.actorRole, dept);

  if (garment.currentStatus !== IN_PROGRESS_STATUS_BY_DEPT[dept]) {
    throw new AppError(
      409,
      'STAGE_NOT_STARTED',
      'Mulai pekerjaan terlebih dahulu sebelum mengisi checklist.'
    );
  }

  const checklistRows = await db
    .select()
    .from(checklists)
    .where(and(eq(checklists.garmentId, garment.id), eq(checklists.department, dept)))
    .limit(1);

  if (!checklistRows.length) {
    throw new AppError(404, 'CHECKLIST_NOT_FOUND', 'Checklist divisi tidak ditemukan.');
  }
  const checklist = checklistRows[0];

  const existingItems = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklist.id));

  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    for (const incoming of params.items) {
      await tx
        .update(checklistItems)
        .set({
          isChecked: incoming.isChecked,
          note: incoming.note?.trim() || null,
          checkedBy: incoming.isChecked ? params.actorUserId : null,
          checkedAt: incoming.isChecked ? now : null,
        })
        .where(
          and(
            eq(checklistItems.checklistId, checklist.id),
            eq(checklistItems.itemKey, incoming.itemKey)
          )
        );
    }

    const refreshedItems = await tx
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.checklistId, checklist.id))
      .orderBy(asc(checklistItems.sortOrder));

    const allChecked =
      existingItems.length > 0 && refreshedItems.every((item) => item.isChecked);
    const isComplete = Boolean(params.identityVerified && allChecked);

    const [savedChecklist] = await tx
      .update(checklists)
      .set({
        identityVerified: params.identityVerified,
        verificationMethod: params.verificationMethod,
        isComplete,
        completedBy: isComplete ? params.actorUserId : null,
        completedAt: isComplete ? now : null,
        updatedAt: now,
      })
      .where(eq(checklists.id, checklist.id))
      .returning();

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'CHECKLIST_SAVED',
      entityType: 'CHECKLIST',
      entityId: checklist.id,
      metadata: { garmentId: garment.id, department: dept, isComplete },
      ipAddress: params.ipAddress,
    });

    return {
      ...savedChecklist,
      items: refreshedItems,
    };
  });

  return updated;
}

export async function completeGarmentStage(params: {
  actorUserId: string;
  actorRole: RoleCode;
  garmentId: string;
  version: number;
  notes?: string | null;
  ipAddress?: string;
}) {
  const garmentRows = await db
    .select()
    .from(garments)
    .where(and(eq(garments.id, params.garmentId), isNull(garments.deletedAt)))
    .limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }
  const garment = garmentRows[0];

  if (
    garment.currentDepartment !== 'SPOTTING' &&
    garment.currentDepartment !== 'IRONING' &&
    garment.currentDepartment !== 'PACKING'
  ) {
    throw new AppError(409, 'INVALID_STAGE', 'Barang tidak berada pada tahap pengerjaan staf.');
  }
  const dept = garment.currentDepartment as OperationalDepartment;

  const checklistRows = await db
    .select()
    .from(checklists)
    .where(and(eq(checklists.garmentId, garment.id), eq(checklists.department, dept)))
    .limit(1);
  if (!checklistRows.length) {
    throw new AppError(404, 'CHECKLIST_NOT_FOUND', 'Checklist tidak ditemukan.');
  }
  const checklist = checklistRows[0];
  const items = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklist.id));

  const allChecked = items.length > 0 && items.every((i) => i.isChecked);

  canCompleteStage({
    currentStatus: garment.currentStatus as GarmentStatus,
    currentDepartment: garment.currentDepartment as Department,
    stageDepartment: dept,
    actorRole: params.actorRole,
    identityVerified: checklist.identityVerified,
    allChecklistItemsChecked: allChecked,
  });

  const stageRows = await db
    .select()
    .from(garmentWorkflowStages)
    .where(eq(garmentWorkflowStages.garmentId, garment.id))
    .orderBy(asc(garmentWorkflowStages.stageOrder));

  const orderedDepts = stageRows.map((s) => s.department as OperationalDepartment);
  const { nextDepartment, nextStatus } = resolveNextWorkflowTarget(orderedDepts, dept);

  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(garments)
      .set({
        currentDepartment: nextDepartment,
        currentStatus: nextStatus,
        assignedStaffId: null,
        version: garment.version + 1,
        updatedAt: now,
      })
      .where(
        and(
          eq(garments.id, garment.id),
          eq(garments.version, params.version),
          eq(garments.currentStatus, garment.currentStatus)
        )
      )
      .returning();

    if (!row) {
      throw new AppError(
        409,
        'CONFLICT_OPTIMISTIC_LOCK',
        'Status barang telah berubah sebelum penyelesaian disimpan. Muat ulang data.'
      );
    }

    await tx
      .update(garmentWorkflowStages)
      .set({
        status: 'COMPLETED',
        completedAt: now,
        notes: params.notes?.trim() || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(garmentWorkflowStages.garmentId, garment.id),
          eq(garmentWorkflowStages.department, dept)
        )
      );

    await tx
      .update(checklists)
      .set({
        isComplete: true,
        completedBy: params.actorUserId,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(checklists.id, checklist.id));

    await tx.insert(handoverRecords).values({
      garmentId: garment.id,
      fromDepartment: dept,
      toDepartment: nextDepartment,
      handedOverBy: params.actorUserId,
      physicalTagVerified: checklist.identityVerified,
      conditionNotes: params.notes?.trim() || null,
      handedOverAt: now,
    });

    await tx.insert(workflowHistory).values({
      garmentId: garment.id,
      previousStatus: garment.currentStatus,
      newStatus: nextStatus,
      fromDepartment: dept,
      toDepartment: nextDepartment,
      performedBy: params.actorUserId,
      notes:
        params.notes?.trim() ||
        (nextStatus === 'READY_FOR_PICKUP'
          ? `Pekerjaan divisi ${dept} selesai & diserahkan ke Admin (Siap Diambil)`
          : `Pekerjaan divisi ${dept} selesai & diserahkan ke divisi ${nextDepartment}`),
    });

    // If all non-deleted garments in the order are READY_FOR_PICKUP, update order status
    if (nextStatus === 'READY_FOR_PICKUP') {
      const siblingGarments = await tx
        .select({ currentStatus: garments.currentStatus })
        .from(garments)
        .where(and(eq(garments.orderId, garment.orderId), isNull(garments.deletedAt)));

      if (
        siblingGarments.length > 0 &&
        siblingGarments.every((g) => g.currentStatus === 'READY_FOR_PICKUP')
      ) {
        await tx
          .update(orders)
          .set({ status: 'READY_FOR_PICKUP', updatedAt: now })
          .where(and(eq(orders.id, garment.orderId), eq(orders.status, 'ACTIVE')));
      }
    }

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'WORKFLOW_STAGE_COMPLETED_AND_HANDED_OVER',
      entityType: 'GARMENT',
      entityId: garment.id,
      metadata: {
        fromDepartment: dept,
        toDepartment: nextDepartment,
        newStatus: nextStatus,
      },
      ipAddress: params.ipAddress,
    });

    return row;
  });

  return updated;
}

export async function handoverGarmentStage(params: {
  actorUserId: string;
  actorRole: RoleCode;
  garmentId: string;
  version: number;
  physicalTagVerified: boolean;
  conditionNotes?: string | null;
  idempotencyKey?: string;
  ipAddress?: string;
}) {
  if (!params.physicalTagVerified) {
    throw new AppError(
      422,
      'PHYSICAL_TAG_VERIFICATION_REQUIRED',
      'Konfirmasi verifikasi identitas barang wajib dicentang saat serah terima.'
    );
  }

  if (params.idempotencyKey) {
    const existingHandover = await db
      .select()
      .from(handoverRecords)
      .where(eq(handoverRecords.idempotencyKey, params.idempotencyKey))
      .limit(1);
    if (existingHandover.length) {
      const g = await db
        .select()
        .from(garments)
        .where(eq(garments.id, params.garmentId))
        .limit(1);
      return g[0];
    }
  }

  return completeGarmentStage({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    garmentId: params.garmentId,
    version: params.version,
    notes: params.conditionNotes,
    ipAddress: params.ipAddress,
  });
}

export async function holdGarment(params: {
  actorUserId: string;
  actorRole: RoleCode;
  garmentId: string;
  version: number;
  reason: string;
  ipAddress?: string;
}) {
  const garmentRows = await db
    .select()
    .from(garments)
    .where(and(eq(garments.id, params.garmentId), isNull(garments.deletedAt)))
    .limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }
  const garment = garmentRows[0];

  if (params.actorRole !== 'ADMIN' && params.actorRole !== garment.currentDepartment) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Anda hanya dapat menahan barang yang sedang berada di divisi Anda.'
    );
  }

  canPlaceOnHold(garment.currentStatus as GarmentStatus);

  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(garments)
      .set({
        previousStatusBeforeHold: garment.currentStatus,
        previousDepartmentBeforeHold: garment.currentDepartment,
        currentStatus: 'ON_HOLD',
        version: garment.version + 1,
        updatedAt: now,
      })
      .where(and(eq(garments.id, garment.id), eq(garments.version, params.version)))
      .returning();

    if (!row) {
      throw new AppError(409, 'CONFLICT_OPTIMISTIC_LOCK', 'Data barang telah berubah.');
    }

    if (
      garment.currentDepartment === 'SPOTTING' ||
      garment.currentDepartment === 'IRONING' ||
      garment.currentDepartment === 'PACKING'
    ) {
      await tx
        .update(garmentWorkflowStages)
        .set({ status: 'ON_HOLD', updatedAt: now })
        .where(
          and(
            eq(garmentWorkflowStages.garmentId, garment.id),
            eq(garmentWorkflowStages.department, garment.currentDepartment)
          )
        );
    }

    await tx.insert(workflowHistory).values({
      garmentId: garment.id,
      previousStatus: garment.currentStatus,
      newStatus: 'ON_HOLD',
      fromDepartment: garment.currentDepartment,
      toDepartment: garment.currentDepartment,
      performedBy: params.actorUserId,
      notes: `Barang ditahan (ON_HOLD): ${params.reason.trim()}`,
    });

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'GARMENT_PUT_ON_HOLD',
      entityType: 'GARMENT',
      entityId: garment.id,
      metadata: { reason: params.reason.trim(), previousStatus: garment.currentStatus },
      ipAddress: params.ipAddress,
    });

    return row;
  });

  return updated;
}

export async function resumeGarment(params: {
  actorUserId: string;
  garmentId: string;
  version: number;
  notes?: string | null;
  ipAddress?: string;
}) {
  const garmentRows = await db
    .select()
    .from(garments)
    .where(and(eq(garments.id, params.garmentId), isNull(garments.deletedAt)))
    .limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }
  const garment = garmentRows[0];

  const { restoreStatus, restoreDepartment } = canResumeFromHold(
    garment.currentStatus as GarmentStatus,
    garment.previousStatusBeforeHold as GarmentStatus | null,
    garment.previousDepartmentBeforeHold as Department | null
  );

  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(garments)
      .set({
        currentStatus: restoreStatus,
        currentDepartment: restoreDepartment,
        previousStatusBeforeHold: null,
        previousDepartmentBeforeHold: null,
        version: garment.version + 1,
        updatedAt: now,
      })
      .where(and(eq(garments.id, garment.id), eq(garments.version, params.version)))
      .returning();

    if (!row) {
      throw new AppError(409, 'CONFLICT_OPTIMISTIC_LOCK', 'Data barang telah berubah.');
    }

    const stageStatus = restoreStatus.endsWith('_IN_PROGRESS') ? 'IN_PROGRESS' : 'PENDING';
    if (
      restoreDepartment === 'SPOTTING' ||
      restoreDepartment === 'IRONING' ||
      restoreDepartment === 'PACKING'
    ) {
      await tx
        .update(garmentWorkflowStages)
        .set({ status: stageStatus, updatedAt: now })
        .where(
          and(
            eq(garmentWorkflowStages.garmentId, garment.id),
            eq(garmentWorkflowStages.department, restoreDepartment)
          )
        );
    }

    await tx.insert(workflowHistory).values({
      garmentId: garment.id,
      previousStatus: 'ON_HOLD',
      newStatus: restoreStatus,
      fromDepartment: garment.currentDepartment,
      toDepartment: restoreDepartment,
      performedBy: params.actorUserId,
      notes: params.notes?.trim() || `Proses dilanjutkan oleh Admin ke status ${restoreStatus}`,
    });

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'GARMENT_HOLD_RESUMED',
      entityType: 'GARMENT',
      entityId: garment.id,
      metadata: { restoreStatus, restoreDepartment },
      ipAddress: params.ipAddress,
    });

    return row;
  });

  return updated;
}

export async function reportGarmentIssue(params: {
  actorUserId: string;
  actorRole: RoleCode;
  garmentId: string;
  issueType: IssueType;
  severity: IssueSeverity;
  description: string;
  putsGarmentOnHold: boolean;
  version: number;
  ipAddress?: string;
}) {
  const garmentRows = await db
    .select()
    .from(garments)
    .where(and(eq(garments.id, params.garmentId), isNull(garments.deletedAt)))
    .limit(1);
  if (!garmentRows.length) {
    throw new AppError(404, 'GARMENT_NOT_FOUND', 'Barang tidak ditemukan.');
  }
  const garment = garmentRows[0];

  if (params.actorRole !== 'ADMIN' && params.actorRole !== garment.currentDepartment) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Staf hanya dapat melaporkan kendala untuk barang di divisinya.'
    );
  }

  if (params.putsGarmentOnHold) {
    canPlaceOnHold(garment.currentStatus as GarmentStatus);
  }

  const created = await db.transaction(async (tx) => {
    const now = new Date();
    const [issue] = await tx
      .insert(issueReports)
      .values({
        garmentId: garment.id,
        department: garment.currentDepartment,
        reportedBy: params.actorUserId,
        issueType: params.issueType,
        severity: params.severity,
        description: params.description.trim(),
        putsGarmentOnHold: params.putsGarmentOnHold,
        resolutionStatus: 'OPEN',
      })
      .returning();

    if (params.issueType === 'MISSING_TAG') {
      await tx
        .update(garments)
        .set({ tagStatus: 'MISSING', updatedAt: now })
        .where(eq(garments.id, garment.id));
    }

    if (params.putsGarmentOnHold) {
      const [held] = await tx
        .update(garments)
        .set({
          previousStatusBeforeHold: garment.currentStatus,
          previousDepartmentBeforeHold: garment.currentDepartment,
          currentStatus: 'ON_HOLD',
          version: garment.version + 1,
          updatedAt: now,
        })
        .where(and(eq(garments.id, garment.id), eq(garments.version, params.version)))
        .returning();

      if (!held) {
        throw new AppError(409, 'CONFLICT_OPTIMISTIC_LOCK', 'Data barang telah berubah.');
      }

      if (
        garment.currentDepartment === 'SPOTTING' ||
        garment.currentDepartment === 'IRONING' ||
        garment.currentDepartment === 'PACKING'
      ) {
        await tx
          .update(garmentWorkflowStages)
          .set({ status: 'ON_HOLD', updatedAt: now })
          .where(
            and(
              eq(garmentWorkflowStages.garmentId, garment.id),
              eq(garmentWorkflowStages.department, garment.currentDepartment)
            )
          );
      }

      await tx.insert(workflowHistory).values({
        garmentId: garment.id,
        previousStatus: garment.currentStatus,
        newStatus: 'ON_HOLD',
        fromDepartment: garment.currentDepartment,
        toDepartment: garment.currentDepartment,
        performedBy: params.actorUserId,
        notes: `Kendala dilaporkan (${params.issueType}): ${params.description.trim()}`,
      });
    }

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'ISSUE_REPORTED',
      entityType: 'ISSUE_REPORT',
      entityId: issue.id,
      metadata: {
        garmentId: garment.id,
        issueType: params.issueType,
        severity: params.severity,
        putsGarmentOnHold: params.putsGarmentOnHold,
      },
      ipAddress: params.ipAddress,
    });

    return issue;
  });

  return created;
}

export async function listIssues(params: {
  actorRole: RoleCode;
  status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
}) {
  const filters = [];
  if (params.status) {
    filters.push(eq(issueReports.resolutionStatus, params.status));
  }
  if (params.actorRole !== 'ADMIN') {
    filters.push(eq(issueReports.department, params.actorRole));
  }

  const rows = await db
    .select({
      issue: issueReports,
      garmentCode: garments.garmentCode,
      garmentName: garments.garmentName,
      physicalTagNumber: garments.physicalTagNumber,
      orderCode: orders.orderCode,
      customerName: orders.customerName,
      reportedByName: users.fullName,
    })
    .from(issueReports)
    .innerJoin(garments, eq(issueReports.garmentId, garments.id))
    .innerJoin(orders, eq(garments.orderId, orders.id))
    .innerJoin(users, eq(issueReports.reportedBy, users.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(issueReports.createdAt))
    .limit(100);

  return rows.map((r) => ({
    ...r.issue,
    garmentCode: r.garmentCode,
    garmentName: r.garmentName,
    physicalTagNumber: r.physicalTagNumber,
    orderCode: r.orderCode,
    customerName: r.customerName,
    reportedByName: r.reportedByName,
  }));
}

export async function resolveIssue(params: {
  actorUserId: string;
  issueId: string;
  resolutionNotes: string;
  ipAddress?: string;
}) {
  const existing = await db
    .select()
    .from(issueReports)
    .where(eq(issueReports.id, params.issueId))
    .limit(1);
  if (!existing.length) {
    throw new AppError(404, 'ISSUE_NOT_FOUND', 'Laporan kendala tidak ditemukan.');
  }

  const [updated] = await db.transaction(async (tx) => {
    const row = await tx
      .update(issueReports)
      .set({
        resolutionStatus: 'RESOLVED',
        resolvedBy: params.actorUserId,
        resolutionNotes: params.resolutionNotes.trim(),
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(issueReports.id, params.issueId))
      .returning();

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'ISSUE_RESOLVED',
      entityType: 'ISSUE_REPORT',
      entityId: params.issueId,
      metadata: { garmentId: existing[0].garmentId },
      ipAddress: params.ipAddress,
    });

    return row;
  });

  return updated;
}

export async function getStaffWorkHistory(userId: string) {
  const rows = await db
    .select({
      history: workflowHistory,
      garmentCode: garments.garmentCode,
      garmentName: garments.garmentName,
      physicalTagNumber: garments.physicalTagNumber,
      orderCode: orders.orderCode,
      customerName: orders.customerName,
    })
    .from(workflowHistory)
    .innerJoin(garments, eq(workflowHistory.garmentId, garments.id))
    .innerJoin(orders, eq(garments.orderId, orders.id))
    .where(eq(workflowHistory.performedBy, userId))
    .orderBy(desc(workflowHistory.createdAt))
    .limit(50);

  return rows.map((r) => ({
    ...r.history,
    garmentCode: r.garmentCode,
    garmentName: r.garmentName,
    physicalTagNumber: r.physicalTagNumber,
    orderCode: r.orderCode,
    customerName: r.customerName,
  }));
}
