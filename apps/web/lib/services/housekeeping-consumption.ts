// @ts-nocheck
import { checkSubscriptionGate, prisma, withIdempotency, writeAuditLog } from '@gojo/db';
import { AppError, type Actor } from '@gojo/types';
import { checkRestockRequired } from './housekeeping-alerts';

type RefillItem = {
  catalogItemId: string;
  qtyAddedToReachPar: number;
};

export async function logConsumptionRefill(
  actor: Actor,
  input: {
    idempotencyKey: string;
    roomId: string;
    reservationId?: string | null;
    assignmentId?: string | null;
    items: RefillItem[];
    evidence?: unknown;
  },
) {
  await checkSubscriptionGate(actor, 'CONSUMPTION_LOG_WRITE', prisma);

  return withIdempotency(`consumption:v1:${actor.propertyId}:${input.idempotencyKey}`, prisma, async () => {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: { id: input.roomId, propertyId: actor.propertyId, deletedAt: null },
        select: { id: true, roomTypeId: true },
      });
      if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);

      const logs = [];
      for (const item of input.items) {
        const catalog = await tx.catalogItem.findFirst({
          where: {
            id: item.catalogItemId,
            propertyId: actor.propertyId,
            itemType: 'AMENITY',
            roomTypeId: room.roomTypeId,
            deletedAt: null,
          },
        });
        if (!catalog || catalog.expectedQtyPerStay === null) {
          throw new AppError('VALIDATION_ERROR', 'Invalid amenity catalog item for room', 422, {
            details: { field: 'catalogItemId', reason: 'INVALID_AMENITY_FOR_ROOM' },
          });
        }
        if (item.qtyAddedToReachPar < 0 || item.qtyAddedToReachPar > catalog.expectedQtyPerStay) {
          throw new AppError('VALIDATION_ERROR', 'qtyAddedToReachPar must be between zero and par', 422, {
            details: { field: 'qtyAddedToReachPar', reason: 'OUT_OF_RANGE' },
          });
        }

        const qtyUsed = catalog.expectedQtyPerStay - item.qtyAddedToReachPar;
        await tx.roomConsumableState.upsert({
          where: {
            propertyId_roomId_catalogItemId: {
              propertyId: actor.propertyId,
              roomId: input.roomId,
              catalogItemId: item.catalogItemId,
            },
          },
          create: {
            propertyId: actor.propertyId,
            roomId: input.roomId,
            catalogItemId: item.catalogItemId,
            currentQty: catalog.expectedQtyPerStay,
            lastRefillAt: new Date(),
          },
          update: {
            currentQty: catalog.expectedQtyPerStay,
            lastRefillAt: new Date(),
            stateVersion: { increment: 1 },
          },
        });

        const log = await tx.consumptionLog.create({
          data: {
            propertyId: actor.propertyId,
            roomId: input.roomId,
            reservationId: input.reservationId ?? null,
            assignmentId: input.assignmentId ?? null,
            catalogItemId: item.catalogItemId,
            qtyAddedToReachPar: item.qtyAddedToReachPar,
            qtyUsed,
            createdBy: actor.userId,
            evidence: input.evidence ?? undefined,
          },
        });
        logs.push(log);
      }

      await writeAuditLog(tx, actor, {
        action: 'CONSUMPTION_LOG_CREATED',
        entityType: 'ROOM',
        entityId: input.roomId,
        after: { roomId: input.roomId, items: input.items, logCount: logs.length },
      });

      return { ok: true, logIds: logs.map((log) => log.id) };
    });

    for (const item of input.items) {
      await checkRestockRequired(actor.propertyId, item.catalogItemId);
    }
    return result;
  });
}
