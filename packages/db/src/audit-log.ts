import type { Actor } from '@gojo/types';

import type { Prisma } from './generated/client/index.js';
import type { DbClient } from './types.js';

export interface WriteAuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.JsonValue | null;
  after?: Prisma.JsonValue | null;
  metadata?: Prisma.JsonValue | null;
  traceId?: string | undefined;
  fromState?: string | null;
  toState?: string | null;
}

export async function writeAuditLog(
  tx: DbClient,
  actor: Actor,
  params: WriteAuditLogParams,
): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    propertyId: actor.propertyId,
    actorId: actor.userId,
    actorRole: actor.role,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
  };

  if (params.before !== undefined) data.before = params.before as Prisma.InputJsonValue;
  if (params.after !== undefined) data.after = params.after as Prisma.InputJsonValue;
  if (params.metadata !== undefined) data.metadata = params.metadata as Prisma.InputJsonValue;
  if (params.fromState !== undefined) data.fromState = params.fromState;
  if (params.toState !== undefined) data.toState = params.toState;
  if (params.traceId !== undefined) data.traceId = params.traceId;

  await tx.auditLog.create({ data });
}
