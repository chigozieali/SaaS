import { db } from "@/lib/prisma";

/**
 * Write an audit log entry for a given organization.
 * Safe to call from anywhere; never throws.
 */
export async function auditLog(params: {
  organizationId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: (params.metadata ?? null) as never,
        ip: params.ip ?? null,
      },
    });
  } catch {
    // audit failures should never break the primary operation
  }
}
