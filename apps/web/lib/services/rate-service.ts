// @ts-nocheck
import { checkSubscriptionGate, prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

export async function updateRoomTypeRates(actor, roomTypeId, input) {
  await checkSubscriptionGate(actor, 'RATE_CONFIG_UPDATE', prisma);

  if (input.ceilingRate && input.floorRate > input.ceilingRate) {
    throw new AppError('INVALID_RATE_RANGE', 'Floor rate must not exceed ceiling rate', 400);
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.roomType.findFirst({
      where: { id: roomTypeId, propertyId: actor.propertyId, deletedAt: null },
    });

    if (!current) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'Room type not found', 403);
    }

    if (current.stateVersion !== input.stateVersion) {
      throw new AppError('CONFLICT', 'Room type was updated by someone else. Refresh and try again.', 409);
    }

    const updated = await tx.roomType.update({
      where: { id: roomTypeId },
      data: {
        floorRate: input.floorRate,
        ceilingRate: input.ceilingRate ?? null,
        stateVersion: { increment: 1 },
      },
    });

    await tx.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'ROOM_TYPE',
        entityId: roomTypeId,
        action: 'RATE_CONFIG_UPDATED',
        actorId: actor.userId,
        actorRole: actor.role,
        metadata: {
          fromFloor: Number(current.floorRate),
          toFloor: input.floorRate,
          fromCeiling: current.ceilingRate ? Number(current.ceilingRate) : null,
          toCeiling: input.ceilingRate ?? null,
        },
      },
    });

    return updated;
  });
}

export async function validateRateForRoomType(actor, roomTypeId, enteredRate) {
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, propertyId: actor.propertyId, deletedAt: null },
  });

  if (!roomType) {
    throw new AppError('PROPERTY_ACCESS_DENIED', 'Room type not found', 403);
  }

  const floorRate = Number(roomType.floorRate);
  const ceilingRate = roomType.ceilingRate ? Number(roomType.ceilingRate) : null;

  if (enteredRate < floorRate) {
    return {
      allowed: true,
      requiresOverrideConfirmation: true,
      delta: floorRate - enteredRate,
      floorRate,
      ceilingRate,
    };
  }

  return {
    allowed: true,
    requiresOverrideConfirmation: false,
    floorRate,
    ceilingRate,
    aboveCeiling: ceilingRate !== null ? enteredRate > ceilingRate : false,
  };
}
