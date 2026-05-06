import { AppError, type Actor } from '@gojo/types';

import { writeAuditedTransition } from '../audit.js';
import type { Prisma } from '../generated/client/index.js';

const ALLOWED_RESERVATION_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['CHECKED_OUT', 'CANCELLED'],
};

export interface ReservationTransitionParams {
  actor: Actor;
  reservationId: string;
  toStatus: string;
  stateVersion: number;
  traceId?: string | undefined;
  metadata?: Prisma.JsonValue | undefined;
}

export async function transitionReservation(
  tx: Prisma.TransactionClient,
  params: ReservationTransitionParams,
) {
  const reservation = await tx.reservation.findFirst({
    where: {
      id: params.reservationId,
      propertyId: params.actor.propertyId,
      deletedAt: null,
    },
  });

  if (!reservation) {
    throw new AppError('NOT_FOUND', 'Reservation not found', 404);
  }

  if (reservation.stateVersion !== params.stateVersion) {
    throw new AppError('CONFLICT', 'Reservation state version mismatch', 409);
  }

  const allowed = ALLOWED_RESERVATION_TRANSITIONS[reservation.status] ?? [];
  if (!allowed.includes(params.toStatus)) {
    throw new AppError('INVALID_TRANSITION', 'Invalid reservation transition', 422);
  }

  const updated = await tx.reservation.update({
    where: { id: params.reservationId },
    data: {
      stateVersion: { increment: 1 },
      status: params.toStatus,
    },
  });

  await writeAuditedTransition(tx, {
    actor: params.actor,
    entityId: params.reservationId,
    entityType: 'reservation',
    fromState: reservation.status,
    metadata: params.metadata,
    toState: params.toStatus,
    traceId: params.traceId,
  });

  return updated;
}
