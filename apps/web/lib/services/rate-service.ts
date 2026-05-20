// @ts-nocheck
import { checkSubscriptionGate, prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

export async function updateRoomTypeRates(actor, roomTypeId, input) {
  await checkSubscriptionGate(actor, 'rate.update', prisma);

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

    // Floor rate is bounded above by the rack (base) rate — it can never sell
    // higher than the rack rate.
    const baseRate = Number(current.baseRate);
    if (input.floorRate > baseRate) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Floor rate cannot be higher than the rack rate (₹${Math.round(baseRate).toLocaleString('en-IN')}).`,
        400,
      );
    }

    const updated = await tx.roomType.update({
      where: { id: roomTypeId },
      data: {
        floorRate: input.floorRate,
        stateVersion: { increment: 1 },
      },
    });

    await tx.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'ROOM_TYPE',
        entityId: roomTypeId,
        action: 'rate.update',
        actorId: actor.userId,
        actorRole: actor.role,
        metadata: {
          fromFloor: Number(current.floorRate),
          toFloor: input.floorRate,
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

  if (enteredRate < floorRate) {
    return {
      allowed: true,
      requiresOverrideConfirmation: true,
      delta: floorRate - enteredRate,
      floorRate,
    };
  }

  return {
    allowed: true,
    requiresOverrideConfirmation: false,
    floorRate,
  };
}
