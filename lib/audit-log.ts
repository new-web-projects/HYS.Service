import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * One call site for every admin action that should show up in the Audit
 * Logs module. Deliberately fire-and-forget from the caller's
 * perspective — an audit-log write failing should never block or roll
 * back the actual admin action it's recording, same philosophy as
 * lib/notifications.ts's email step.
 */
export async function logAdminAction(params: {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}