import { and, count, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  garmentPhotos,
  garments,
  issueReports,
  orders,
  systemSettings,
  users,
  workflowHistory,
} from '../../db/schema.ts';
import type { OperationalDepartment } from '../../shared/types.ts';
import { writeAuditLog } from './audit.service.ts';

const ACTIVE_GARMENT_STATUSES = [
  'REGISTERED',
  'WAITING_SPOTTING',
  'SPOTTING_IN_PROGRESS',
  'WAITING_IRONING',
  'IRONING_IN_PROGRESS',
  'WAITING_PACKING',
  'PACKING_IN_PROGRESS',
  'READY_FOR_PICKUP',
  'ON_HOLD',
];

export async function getAdminOverview() {
  const now = new Date();

  const [garmentStatsRows, orderStatsRows, delayedRows, onHoldRows, recentActivitiesRows, openIssuesRows] =
    await Promise.all([
      db
        .select({
          totalActive: sql<number>`count(*) filter (where ${garments.currentStatus} != 'PICKED_UP')::int`,
          waiting: sql<number>`count(*) filter (where ${garments.currentStatus} in ('REGISTERED','WAITING_SPOTTING','WAITING_IRONING','WAITING_PACKING'))::int`,
          inProgress: sql<number>`count(*) filter (where ${garments.currentStatus} in ('SPOTTING_IN_PROGRESS','IRONING_IN_PROGRESS','PACKING_IN_PROGRESS'))::int`,
          readyForPickup: sql<number>`count(*) filter (where ${garments.currentStatus} = 'READY_FOR_PICKUP')::int`,
          onHold: sql<number>`count(*) filter (where ${garments.currentStatus} = 'ON_HOLD')::int`,
          spottingCount: sql<number>`count(*) filter (where ${garments.currentDepartment} = 'SPOTTING' and ${garments.currentStatus} != 'PICKED_UP')::int`,
          ironingCount: sql<number>`count(*) filter (where ${garments.currentDepartment} = 'IRONING' and ${garments.currentStatus} != 'PICKED_UP')::int`,
          packingCount: sql<number>`count(*) filter (where ${garments.currentDepartment} = 'PACKING' and ${garments.currentStatus} != 'PICKED_UP')::int`,
        })
        .from(garments)
        .where(isNull(garments.deletedAt)),
      db
        .select({
          ordersReady: sql<number>`count(*) filter (where ${orders.status} = 'READY_FOR_PICKUP')::int`,
          ordersActive: sql<number>`count(*) filter (where ${orders.status} = 'ACTIVE')::int`,
          ordersArchived: sql<number>`count(*) filter (where ${orders.status} = 'ARCHIVED')::int`,
        })
        .from(orders),
      db
        .select({
          id: garments.id,
          garmentCode: garments.garmentCode,
          garmentName: garments.garmentName,
          physicalTagNumber: garments.physicalTagNumber,
          currentDepartment: garments.currentDepartment,
          currentStatus: garments.currentStatus,
          dueAt: garments.dueAt,
          orderCode: orders.orderCode,
          customerName: orders.customerName,
        })
        .from(garments)
        .innerJoin(orders, eq(garments.orderId, orders.id))
        .where(
          and(
            isNull(garments.deletedAt),
            inArray(garments.currentStatus, ACTIVE_GARMENT_STATUSES),
            lt(garments.dueAt, now)
          )
        )
        .orderBy(garments.dueAt)
        .limit(10),
      db
        .select({
          id: garments.id,
          garmentCode: garments.garmentCode,
          garmentName: garments.garmentName,
          physicalTagNumber: garments.physicalTagNumber,
          currentDepartment: garments.currentDepartment,
          orderCode: orders.orderCode,
          customerName: orders.customerName,
          updatedAt: garments.updatedAt,
        })
        .from(garments)
        .innerJoin(orders, eq(garments.orderId, orders.id))
        .where(and(isNull(garments.deletedAt), eq(garments.currentStatus, 'ON_HOLD')))
        .orderBy(desc(garments.updatedAt))
        .limit(10),
      db
        .select({
          id: workflowHistory.id,
          garmentId: workflowHistory.garmentId,
          previousStatus: workflowHistory.previousStatus,
          newStatus: workflowHistory.newStatus,
          fromDepartment: workflowHistory.fromDepartment,
          toDepartment: workflowHistory.toDepartment,
          notes: workflowHistory.notes,
          createdAt: workflowHistory.createdAt,
          garmentCode: garments.garmentCode,
          garmentName: garments.garmentName,
          physicalTagNumber: garments.physicalTagNumber,
          performedByName: users.fullName,
        })
        .from(workflowHistory)
        .innerJoin(garments, eq(workflowHistory.garmentId, garments.id))
        .innerJoin(users, eq(workflowHistory.performedBy, users.id))
        .orderBy(desc(workflowHistory.createdAt))
        .limit(15),
      db
        .select({ total: count() })
        .from(issueReports)
        .where(eq(issueReports.resolutionStatus, 'OPEN')),
    ]);

  const gStats = garmentStatsRows[0] ?? {
    totalActive: 0,
    waiting: 0,
    inProgress: 0,
    readyForPickup: 0,
    onHold: 0,
    spottingCount: 0,
    ironingCount: 0,
    packingCount: 0,
  };
  const oStats = orderStatsRows[0] ?? {
    ordersReady: 0,
    ordersActive: 0,
    ordersArchived: 0,
  };

  return {
    counts: {
      totalActiveGarments: Number(gStats.totalActive),
      waitingGarments: Number(gStats.waiting),
      inProgressGarments: Number(gStats.inProgress),
      readyForPickupGarments: Number(gStats.readyForPickup),
      onHoldGarments: Number(gStats.onHold),
      ordersAwaitingPickup: Number(oStats.ordersReady),
      ordersActive: Number(oStats.ordersActive),
      ordersArchived: Number(oStats.ordersArchived),
      openIssues: Number(openIssuesRows[0]?.total ?? 0),
    },
    departments: {
      SPOTTING: Number(gStats.spottingCount),
      IRONING: Number(gStats.ironingCount),
      PACKING: Number(gStats.packingCount),
    },
    delayedGarments: delayedRows,
    onHoldGarments: onHoldRows,
    recentActivities: recentActivitiesRows,
  };
}

export async function getStaffDashboardSummary(params: {
  department: OperationalDepartment;
  userId: string;
}) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const waitingStatus = `WAITING_${params.department}`;
  const inProgressStatus = `${params.department}_IN_PROGRESS`;

  const [queueStats, completedTodayRows] = await Promise.all([
    db
      .select({
        waiting: sql<number>`count(*) filter (where ${garments.currentStatus} = ${waitingStatus})::int`,
        inProgress: sql<number>`count(*) filter (where ${garments.currentStatus} = ${inProgressStatus})::int`,
        onHold: sql<number>`count(*) filter (where ${garments.currentStatus} = 'ON_HOLD')::int`,
      })
      .from(garments)
      .where(and(isNull(garments.deletedAt), eq(garments.currentDepartment, params.department))),
    db
      .select({ total: count() })
      .from(workflowHistory)
      .where(
        and(
          eq(workflowHistory.fromDepartment, params.department),
          eq(workflowHistory.performedBy, params.userId),
          gte(workflowHistory.createdAt, startOfDay),
          sql`${workflowHistory.previousStatus} = ${inProgressStatus}`
        )
      ),
  ]);

  return {
    waiting: Number(queueStats[0]?.waiting ?? 0),
    inProgress: Number(queueStats[0]?.inProgress ?? 0),
    onHold: Number(queueStats[0]?.onHold ?? 0),
    completedToday: Number(completedTodayRows[0]?.total ?? 0),
  };
}

export async function getDepartmentsReport() {
  const now = new Date();
  const rows = await db
    .select({
      department: garments.currentDepartment,
      waiting: sql<number>`count(*) filter (where ${garments.currentStatus} like 'WAITING_%')::int`,
      inProgress: sql<number>`count(*) filter (where ${garments.currentStatus} like '%_IN_PROGRESS')::int`,
      onHold: sql<number>`count(*) filter (where ${garments.currentStatus} = 'ON_HOLD')::int`,
      delayed: sql<number>`count(*) filter (where ${garments.dueAt} < ${now} and ${garments.currentStatus} in ('WAITING_SPOTTING','SPOTTING_IN_PROGRESS','WAITING_IRONING','IRONING_IN_PROGRESS','WAITING_PACKING','PACKING_IN_PROGRESS'))::int`,
    })
    .from(garments)
    .where(
      and(
        isNull(garments.deletedAt),
        inArray(garments.currentDepartment, ['SPOTTING', 'IRONING', 'PACKING'])
      )
    )
    .groupBy(garments.currentDepartment);

  const map = new Map(rows.map((r) => [r.department, r]));
  return (['SPOTTING', 'IRONING', 'PACKING'] as const).map((dept) => {
    const r = map.get(dept);
    return {
      department: dept,
      waiting: Number(r?.waiting ?? 0),
      inProgress: Number(r?.inProgress ?? 0),
      onHold: Number(r?.onHold ?? 0),
      delayed: Number(r?.delayed ?? 0),
    };
  });
}

export async function getCompletedReport() {
  const [statusBreakdown, categoryBreakdown, issueSummary] = await Promise.all([
    db
      .select({
        status: garments.currentStatus,
        total: count(),
      })
      .from(garments)
      .where(isNull(garments.deletedAt))
      .groupBy(garments.currentStatus),
    db
      .select({
        category: orders.orderCategory,
        orderCount: count(),
      })
      .from(orders)
      .groupBy(orders.orderCategory),
    db
      .select({
        issueType: issueReports.issueType,
        resolutionStatus: issueReports.resolutionStatus,
        total: count(),
      })
      .from(issueReports)
      .groupBy(issueReports.issueType, issueReports.resolutionStatus),
  ]);

  return {
    statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, total: Number(s.total) })),
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c.category,
      orderCount: Number(c.orderCount),
    })),
    issueSummary: issueSummary.map((i) => ({
      issueType: i.issueType,
      resolutionStatus: i.resolutionStatus,
      total: Number(i.total),
    })),
  };
}

export async function globalSearch(query: string) {
  const clean = query.trim();
  if (!clean) return { garments: [], orders: [] };
  const q = `%${clean}%`;

  const [garmentResults, orderResults] = await Promise.all([
    db
      .select({
        id: garments.id,
        garmentCode: garments.garmentCode,
        garmentName: garments.garmentName,
        garmentType: garments.garmentType,
        brand: garments.brand,
        color: garments.color,
        physicalTagNumber: garments.physicalTagNumber,
        tagStatus: garments.tagStatus,
        currentStatus: garments.currentStatus,
        currentDepartment: garments.currentDepartment,
        orderId: garments.orderId,
        orderCode: orders.orderCode,
        customerName: orders.customerName,
      })
      .from(garments)
      .innerJoin(orders, eq(garments.orderId, orders.id))
      .where(
        and(
          isNull(garments.deletedAt),
          or(
            ilike(garments.garmentCode, q),
            ilike(garments.physicalTagNumber, q),
            ilike(garments.garmentName, q),
            ilike(garments.garmentType, q),
            ilike(garments.brand, q),
            ilike(garments.color, q),
            ilike(garments.distinctiveFeatures, q),
            ilike(orders.orderCode, q),
            ilike(orders.customerName, q)
          )
        )
      )
      .orderBy(desc(garments.createdAt))
      .limit(20),
    db
      .select()
      .from(orders)
      .where(
        or(
          ilike(orders.orderCode, q),
          ilike(orders.customerName, q),
          ilike(orders.customerPhone, q)
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(10),
  ]);

  const gIds = garmentResults.map((g) => g.id);
  const thumbMap = new Map<string, string>();
  if (gIds.length) {
    const photos = await db
      .select({
        id: garmentPhotos.id,
        garmentId: garmentPhotos.garmentId,
        photoType: garmentPhotos.photoType,
      })
      .from(garmentPhotos)
      .where(and(inArray(garmentPhotos.garmentId, gIds), isNull(garmentPhotos.deletedAt)));
    for (const p of photos) {
      if (!thumbMap.has(p.garmentId) || p.photoType === 'FRONT') {
        thumbMap.set(p.garmentId, `/api/v1/photos/${p.id}/file?variant=thumb`);
      }
    }
  }

  return {
    garments: garmentResults.map((g) => ({
      ...g,
      thumbnailUrl: thumbMap.get(g.id) ?? null,
    })),
    orders: orderResults,
  };
}

export async function getSystemSettings() {
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function updateSystemSetting(params: {
  actorUserId: string;
  key: string;
  value: unknown;
  ipAddress?: string;
}) {
  await db.transaction(async (tx) => {
    await tx
      .insert(systemSettings)
      .values({
        key: params.key,
        value: params.value,
        updatedBy: params.actorUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: params.value,
          updatedBy: params.actorUserId,
          updatedAt: new Date(),
        },
      });

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'SYSTEM_SETTING_UPDATED',
      entityType: 'SYSTEM_SETTING',
      entityId: params.key,
      metadata: { key: params.key },
      ipAddress: params.ipAddress,
    });
  });

  return getSystemSettings();
}
