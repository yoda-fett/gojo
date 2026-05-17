// @ts-nocheck
import { writeAuditLog } from '@gojo/db';
import { AppError } from '@gojo/types';

import type { Prisma } from '@gojo/db/generated/client';

/**
 * Atomic room state transition with optimistic concurrency.
 * Throws CONFLICT if `expectedStateVersion` does not match the current row.
 *
 * @gateExempt Internal helper — gate is enforced by the calling service.
 */
export async function transitionRoomState(
  tx: Prisma.TransactionClient,
  actor: { userId: string; propertyId: string; role: string },
  params: {
    roomId: string;
    expectedStateVersion: number;
    fromState: string;
    toState: string;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  const updated = await tx.room
    .updateMany({
      where: {
        id: params.roomId,
        propertyId: actor.propertyId,
        stateVersion: params.expectedStateVersion,
        deletedAt: null,
      },
      data: {
        state: params.toState,
        stateVersion: { increment: 1 },
      },
    })
    .catch(() => null);

  if (!updated || updated.count === 0) {
    throw new AppError(
      'CONFLICT',
      `Room ${params.roomId} stateVersion mismatch (expected ${params.expectedStateVersion})`,
      409,
    );
  }

  await writeAuditLog(tx, actor as never, {
    action: params.action,
    entityType: 'ROOM',
    entityId: params.roomId,
    fromState: params.fromState,
    toState: params.toState,
    before: { state: params.fromState, stateVersion: params.expectedStateVersion },
    after: { state: params.toState, stateVersion: params.expectedStateVersion + 1 },
    metadata: params.metadata as never,
  });
}
