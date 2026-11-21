import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { garments, orders, pickupRecords, workflowHistory } from '../../db/schema.ts';
import { AppError } from '../errors/app-error.ts';
import { writeAuditLog } from './audit.service.ts';

export async function confirmOrderPickup(params: {
  actorUserId: string;
  orderId: string;
  recipientName: string;
  recipientPhone?: string | null;
  verificationNotes?: string | null;
  expectedGarmentCount: number;
  idempotencyKey?: string;
  ipAddress?: string;
}) {
  if (params.idempotencyKey) {
    const existingByKey = await db
      .select()
      .from(pickupRecords)
      .where(eq(pickupRecords.idempotencyKey, params.idempotencyKey))
      .limit(1);
    if (existingByKey.length) {
      return existingByKey[0];
    }
  }

  const result = await db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, params.orderId))
      .limit(1);

    if (!orderRows.length) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan.');
    }
    const order = orderRows[0];

    if (order.status === 'ARCHIVED') {
      throw new AppError(
        409,
        'DUPLICATE_PICKUP',
        'Pengambilan pesanan ini sudah pernah dikonfirmasi dan telah diarsipkan.'
      );
    }
    if (order.status === 'CANCELLED') {
      throw new AppError(409, 'ORDER_CANCELLED', 'Pesanan yang dibatalkan tidak dapat diambil.');
    }

    const existingPickup = await tx
      .select()
      .from(pickupRecords)
      .where(eq(pickupRecords.orderId, order.id))
      .limit(1);

    if (existingPickup.length) {
      throw new AppError(
        409,
        'DUPLICATE_PICKUP',
        'Catatan pengambilan untuk pesanan ini sudah ada.'
      );
    }

    const orderGarments = await tx
      .select()
      .from(garments)
      .where(and(eq(garments.orderId, order.id), isNull(garments.deletedAt)));

    if (!orderGarments.length) {
      throw new AppError(
        422,
        'ORDER_HAS_NO_GARMENTS',
        'Pesanan belum memiliki barang terdaftar.'
      );
    }

    if (orderGarments.length !== params.expectedGarmentCount) {
      throw new AppError(
        422,
        'GARMENT_COUNT_MISMATCH',
        `Rekonsiliasi jumlah barang tidak cocok. Tercatat ${orderGarments.length} barang, konfirmasi Anda ${params.expectedGarmentCount}.`
      );
    }

    const notReady = orderGarments.filter((g) => g.currentStatus !== 'READY_FOR_PICKUP');
    if (notReady.length) {
      throw new AppError(
        409,
        'GARMENTS_NOT_READY',
        `Masih ada ${notReady.length} barang yang belum berstatus Siap Diambil (contoh: ${notReady[0].garmentCode} - ${notReady[0].currentStatus}). Pengambilan parsial tidak diperbolehkan.`
      );
    }

    const now = new Date();
    const [pickup] = await tx
      .insert(pickupRecords)
      .values({
        orderId: order.id,
        confirmedBy: params.actorUserId,
        recipientName: params.recipientName.trim(),
        recipientPhone: params.recipientPhone?.trim() || null,
        verificationNotes: params.verificationNotes?.trim() || null,
        garmentCount: orderGarments.length,
        idempotencyKey: params.idempotencyKey ?? null,
        pickedUpAt: now,
      })
      .returning();

    await tx
      .update(garments)
      .set({
        currentStatus: 'PICKED_UP',
        currentDepartment: 'PICKUP',
        updatedAt: now,
      })
      .where(and(eq(garments.orderId, order.id), isNull(garments.deletedAt)));

    await tx.insert(workflowHistory).values(
      orderGarments.map((g) => ({
        garmentId: g.id,
        previousStatus: g.currentStatus,
        newStatus: 'PICKED_UP',
        fromDepartment: g.currentDepartment,
        toDepartment: 'PICKUP',
        performedBy: params.actorUserId,
        notes: `Pesanan diambil oleh ${params.recipientName.trim()} & dipindahkan ke arsip`,
      }))
    );

    await tx
      .update(orders)
      .set({
        status: 'ARCHIVED',
        archivedAt: now,
        version: order.version + 1,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    await writeAuditLog(tx, {
      actorUserId: params.actorUserId,
      action: 'ORDER_PICKUP_CONFIRMED_AND_ARCHIVED',
      entityType: 'ORDER',
      entityId: order.id,
      metadata: {
        orderCode: order.orderCode,
        garmentCount: orderGarments.length,
        recipientName: params.recipientName.trim(),
      },
      ipAddress: params.ipAddress,
    });

    return pickup;
  });

  return result;
}
