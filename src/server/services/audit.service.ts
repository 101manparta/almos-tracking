import { db } from '../../db/index.ts';
import { auditLogs } from '../../db/schema.ts';

type DbLike = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function writeAuditLog(
  tx: DbLike,
  params: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
  }
) {
  await tx.insert(auditLogs).values({
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? {},
    ipAddress: params.ipAddress ?? null,
  });
}
