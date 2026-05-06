import { AppError, type Actor } from '@gojo/types';

import { writeAuditedTransition } from '../audit.js';
import type { Prisma } from '../generated/client/index.js';

const ALLOWED_ROOM_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ['OCCUPIED', 'OOO', 'HOLD', 'RESERVED'],
  HOLD: ['AVAILABLE', 'RESERVED'],
  RESERVED: ['AVAILABLE', 'OCCUPIED'],
  OCCUPIED: ['DIRTY'],
  DIRTY: ['CLEAN'],
  CLEAN: ['AVAILABLE'],
  OOO: ['AVAILABLE'],
  MAINTENANCE: ['AVAILABLE'],
};

export interface RoomTransitionParams {
  actor: Actor;
  roomId: string;
  toState: string;
  stateVersion: number;
  traceId?: string | undefined;
  metadata?: Prisma.JsonValue | undefined;
}

export async function transitionRoom(tx: Prisma.TransactionClient, params: RoomTransitionParams) {
  const room = await tx.room.findFirst({
    where: {
      id: params.roomId,
      propertyId: params.actor.propertyId,
      deletedAt: null,
    },
  });

  if (!room) {
    throw new AppError('NOT_FOUND', 'Room not found', 404);
  }

  if (room.stateVersion !== params.stateVersion) {
    throw new AppError('CONFLICT', 'Room state version mismatch', 409);
  }

  const allowed = ALLOWED_ROOM_TRANSITIONS[room.state] ?? [];
  if (!allowed.includes(params.toState)) {
    throw new AppError('INVALID_TRANSITION', 'Invalid room transition', 422);
  }

  const updated = await tx.room.update({
    where: { id: params.roomId },
    data: {
      state: params.toState,
      stateVersion: { increment: 1 },
    },
  });

  await writeAuditedTransition(tx, {
    actor: params.actor,
    entityId: params.roomId,
    entityType: 'room',
    fromState: room.state,
    metadata: params.metadata,
    toState: params.toState,
    traceId: params.traceId,
  });

  return updated;
}
