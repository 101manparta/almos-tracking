import { and, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  garments,
  orders,
  pickupRecords,
  users,
} from '../../db/schema.ts';
import type { OrderCategory, OrderStatus } from '../../shared/types.ts';
import { AppError } from '../errors/app-error.ts';
import { writeAuditLog } from './audit.service.ts';

async function generateOrderCode(): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `ALM-${ym}-`;
  const existing = await db
    .select({ orderCode: orders.orderCode })
    .from(orders)
    .where(ilike(orders.orderCode, `${prefix}%`))
    .orderBy(desc(orders.orderCode))
    .limit(1);

  let nextNum = 1;
  if (existing.length) {
    const tail = existing[0].orderCode.split('-').pop();
    const parsed = Number(tail);
    if (!Number.isNaN(parsed)) nextNum = parsed + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

export async function createOrder(params: {
  actorUserId: string;
  customerName: string;
  customerPhone: string;
  orderCategory: OrderCategory;
  expectedCompletionAt?: string | null;
  notes?: string | null;
  ipAddress?: string;
}) {
  const orderCode = await generateOrderCode();
  const expectedDate = params.expectedCompletionAt
    ? new Date(params.expectedCompletionAt)
    : null;

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(orders)
      .values({
        orderCode,
        customerName: params.customerName.trim(),
        customerPhone: params.customerPhone.trim(),
        orderCategory: params.orderCategory,
        expectedCompletionAt: expectedDate,
        notes: params.notes?.trim() || null,
        status: 'ACTIVE',
        createdBy: params.actorUserId,
      })
      .returning();

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'ORDER_CREATED',
      entityType: 'ORDER',
      entityId: inserted.id,
      metadata: { orderCode, customerName: inserted.customerName, orderCategory: params.orderCategory },
      ipAddress: params.ipAddress,
    });

    return inserted;
  });

  return created;
}

export async function listOrders(params: {
  page: number;
  perPage: number;
  search?: string;
  status?: OrderStatus | 'ALL_ACTIVE';
  category?: OrderCategory;
}) {
  const offset = (params.page - 1) * params.perPage;
  const filters = [];

  if (params.status === 'ARCHIVED' || params.status === 'CANCELLED' || params.status === 'ACTIVE' || params.status === 'READY_FOR_PICKUP') {
    filters.push(eq(orders.status, params.status));
  } else {
    // Active operational view excludes ARCHIVED and CANCELLED by default
    filters.push(inArray(orders.status, ['ACTIVE', 'READY_FOR_PICKUP']));
  }

  if (params.category) {
    filters.push(eq(orders.orderCategory, params.category));
  }

  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    filters.push(
      or(
        ilike(orders.orderCode, q),
        ilike(orders.customerName, q),
        ilike(orders.customerPhone, q)
      )
    );
  }

  const whereClause = filters.length ? and(...filters) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(orders)
    .where(whereClause);

  const rows = await db
    .select({
      order: orders,
      creatorName: users.fullName,
    })
    .from(orders)
    .innerJoin(users, eq(orders.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(params.perPage)
    .offset(offset);

  const orderIds = rows.map((r) => r.order.id);
  const garmentStatsMap = new Map<
    string,
    { total: number; ready: number; onHold: number; pickedUp: number }
  >();

  if (orderIds.length) {
    const statsRows = await db
      .select({
        orderId: garments.orderId,
        total: count(),
        ready: sql<number>`count(*) filter (where ${garments.currentStatus} = 'READY_FOR_PICKUP')::int`,
        onHold: sql<number>`count(*) filter (where ${garments.currentStatus} = 'ON_HOLD')::int`,
        pickedUp: sql<number>`count(*) filter (where ${garments.currentStatus} = 'PICKED_UP')::int`,
      })
      .from(garments)
      .where(and(inArray(garments.orderId, orderIds), isNull(garments.deletedAt)))
      .groupBy(garments.orderId);

    for (const s of statsRows) {
      garmentStatsMap.set(s.orderId, {
        total: Number(s.total),
        ready: Number(s.ready),
        onHold: Number(s.onHold),
        pickedUp: Number(s.pickedUp),
      });
    }
  }

  const items = rows.map((r) => {
    const stats = garmentStatsMap.get(r.order.id) ?? {
      total: 0,
      ready: 0,
      onHold: 0,
      pickedUp: 0,
    };
    return {
      ...r.order,
      creatorName: r.creatorName,
      garmentCount: stats.total,
      readyCount: stats.ready,
      onHoldCount: stats.onHold,
      pickedUpCount: stats.pickedUp,
      isPickupEligible:
        r.order.status !== 'ARCHIVED' &&
        r.order.status !== 'CANCELLED' &&
        stats.total > 0 &&
        stats.ready === stats.total,
    };
  });

  return {
    items,
    meta: {
      page: params.page,
      perPage: params.perPage,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / params.perPage)),
    },
  };
}

export async function getOrderById(orderId: string) {
  const rows = await db
    .select({
      order: orders,
      creatorName: users.fullName,
    })
    .from(orders)
    .innerJoin(users, eq(orders.createdBy, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!rows.length) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.');
  }

  const childGarments = await db
    .select()
    .from(garments)
    .where(and(eq(garments.orderId, orderId), isNull(garments.deletedAt)))
    .orderBy(garments.createdAt);

  const pickup = await db
    .select({
      record: pickupRecords,
      confirmedByName: users.fullName,
    })
    .from(pickupRecords)
    .innerJoin(users, eq(pickupRecords.confirmedBy, users.id))
    .where(eq(pickupRecords.orderId, orderId))
    .limit(1);

  const readyCount = childGarments.filter((g) => g.currentStatus === 'READY_FOR_PICKUP').length;
  const onHoldCount = childGarments.filter((g) => g.currentStatus === 'ON_HOLD').length;

  return {
    ...rows[0].order,
    creatorName: rows[0].creatorName,
    garments: childGarments,
    garmentCount: childGarments.length,
    readyCount,
    onHoldCount,
    isPickupEligible:
      rows[0].order.status !== 'ARCHIVED' &&
      rows[0].order.status !== 'CANCELLED' &&
      childGarments.length > 0 &&
      readyCount === childGarments.length,
    pickupRecord: pickup.length
      ? { ...pickup[0].record, confirmedByName: pickup[0].confirmedByName }
      : null,
  };
}

export async function updateOrder(params: {
  actorUserId: string;
  orderId: string;
  version: number;
  customerName?: string;
  customerPhone?: string;
  orderCategory?: OrderCategory;
  expectedCompletionAt?: string | null;
  notes?: string | null;
  ipAddress?: string;
}) {
  const existing = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!existing.length) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.');
  }
  if (existing[0].status === 'ARCHIVED' || existing[0].status === 'CANCELLED') {
    throw new AppError(409, 'ORDER_IMMUTABLE', 'Pesanan yang sudah diarsipkan atau dibatalkan tidak dapat diubah.');
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(orders)
      .set({
        ...(params.customerName !== undefined ? { customerName: params.customerName.trim() } : {}),
        ...(params.customerPhone !== undefined ? { customerPhone: params.customerPhone.trim() } : {}),
        ...(params.orderCategory !== undefined ? { orderCategory: params.orderCategory } : {}),
        ...(params.expectedCompletionAt !== undefined
          ? {
              expectedCompletionAt: params.expectedCompletionAt
                ? new Date(params.expectedCompletionAt)
                : null,
            }
          : {}),
        ...(params.notes !== undefined ? { notes: params.notes?.trim() || null } : {}),
        version: existing[0].version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, params.orderId), eq(orders.version, params.version)))
      .returning();

    if (!row) {
      throw new AppError(
        409,
        'CONFLICT_OPTIMISTIC_LOCK',
        'Pesanan telah diperbarui oleh pengguna lain. Muat ulang data terbaru.'
      );
    }

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'ORDER_UPDATED',
      entityType: 'ORDER',
      entityId: row.id,
      metadata: { orderCode: row.orderCode },
      ipAddress: params.ipAddress,
    });

    return row;
  });

  return updated;
}

export async function cancelOrder(params: {
  actorUserId: string;
  orderId: string;
  reason: string;
  ipAddress?: string;
}) {
  const existing = await db.select().from(orders).where(eq(orders.id, params.orderId)).limit(1);
  if (!existing.length) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.');
  }
  if (existing[0].status === 'ARCHIVED' || existing[0].status === 'CANCELLED') {
    throw new AppError(409, 'ORDER_IMMUTABLE', 'Pesanan sudah diarsipkan atau dibatalkan.');
  }

  const startedGarments = await db
    .select({ id: garments.id })
    .from(garments)
    .where(
      and(
        eq(garments.orderId, params.orderId),
        isNull(garments.deletedAt),
        ne(garments.currentStatus, 'REGISTERED'),
        ne(garments.currentStatus, 'WAITING_SPOTTING'),
        ne(garments.currentStatus, 'WAITING_IRONING'),
        ne(garments.currentStatus, 'WAITING_PACKING')
      )
    )
    .limit(1);

  if (startedGarments.length) {
    throw new AppError(
      409,
      'ORDER_HAS_ACTIVE_PROCESSING',
      'Pesanan tidak dapat dibatalkan karena terdapat barang yang sudah mulai diproses.'
    );
  }

  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(orders)
      .set({
        status: 'CANCELLED',
        cancelledAt: now,
        cancelReason: params.reason.trim(),
        version: existing[0].version + 1,
        updatedAt: now,
      })
      .where(eq(orders.id, params.orderId))
      .returning();

    await tx
      .update(garments)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(garments.orderId, params.orderId), isNull(garments.deletedAt)));

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'ORDER_CANCELLED',
      entityType: 'ORDER',
      entityId: params.orderId,
      metadata: { reason: params.reason.trim() },
      ipAddress: params.ipAddress,
    });

    return row;
  });

  return updated;
}

export async function listArchiveOrders(params: {
  page: number;
  perPage: number;
  search?: string;
  category?: OrderCategory;
}) {
  const offset = (params.page - 1) * params.perPage;
  const filters = [eq(orders.status, 'ARCHIVED')];

  if (params.category) {
    filters.push(eq(orders.orderCategory, params.category));
  }
  if (params.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    filters.push(
      or(
        ilike(orders.orderCode, q),
        ilike(orders.customerName, q),
        ilike(orders.customerPhone, q)
      )!
    );
  }

  const whereClause = and(...filters);
  const [{ total }] = await db.select({ total: count() }).from(orders).where(whereClause);

  const rows = await db
    .select({
      order: orders,
      pickupRecord: pickupRecords,
      confirmedByName: users.fullName,
    })
    .from(orders)
    .leftJoin(pickupRecords, eq(orders.id, pickupRecords.orderId))
    .leftJoin(users, eq(pickupRecords.confirmedBy, users.id))
    .where(whereClause)
    .orderBy(desc(orders.archivedAt))
    .limit(params.perPage)
    .offset(offset);

  return {
    items: rows.map((r) => ({
      ...r.order,
      pickupRecord: r.pickupRecord
        ? { ...r.pickupRecord, confirmedByName: r.confirmedByName }
        : null,
    })),
    meta: {
      page: params.page,
      perPage: params.perPage,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / params.perPage)),
    },
  };
}
