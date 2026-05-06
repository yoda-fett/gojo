import type { Actor } from '@gojo/types';

import { writeAuditLog } from './audit-log.js';
import type { Prisma } from './generated/client/index.js';
import type { DbClient } from './types.js';

export interface AuditedTransitionParams {
  entityType: string;
  entityId: string;
  fromState: string | null;
  toState: string;
  actor: Actor;
  traceId?: string | undefined;
  metadata?: Prisma.JsonValue | undefined;
}

/**
 * Thin wrapper around `writeAuditLog` for the state-transition pattern where
 * the action name *is* the new state (e.g. CHECK_IN, CANCEL). Prefer calling
 * `writeAuditLog` directly for new code; this exists for callers that already
 * carry a `fromState` / `toState` shape (Story 2/4 services).
 */
export async function writeAuditedTransition(
  tx: DbClient,
  params: AuditedTransitionParams,
) {
  await writeAuditLog(tx, params.actor, {
    action: params.toState,
    entityType: params.entityType,
    entityId: params.entityId,
    fromState: params.fromState,
    toState: params.toState,
    ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    ...(params.traceId !== undefined ? { traceId: params.traceId } : {}),
  });
}
