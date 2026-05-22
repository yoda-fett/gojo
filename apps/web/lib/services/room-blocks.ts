// @ts-nocheck
import { checkSubscriptionGate, prisma, writeAuditLog } from '@gojo/db';
import { AppError } from '@gojo/types';
import { startOfDay } from 'date-fns';

// Epic 15 — out-of-order / maintenance are modelled purely as RoomBlock rows.
// A block carries a duration (open-ended when endDate is null) and a reason,
// and overrides the room's *display* status via precedence. It never writes
// the room's housekeeping or occupancy axes. When a block lifts — manually or
// via the expiry sweep — the room is marked DIRTY (Rule R4: a pre-resale clean).

export async function createRoomBlock({
  actor,
  roomId,
  blockType,
  startDate,
  endDate,
  reason,
}: {
  actor: { userId: string; propertyId: string; role: string };
  roomId: string;
  blockType: 'OUT_OF_ORDER' | 'MAINTENANCE';
  startDate: Date;
  endDate: Date | null;
  reason: string;
}) {
  await checkSubscriptionGate(actor, 'room.createBlock', prisma);
  if (endDate && endDate < startDate) {
    throw new AppError('VALIDATION_ERROR', 'endDate must be on or after startDate', 400);
  }

  const room = await prisma.room.findFirst({
    where: { id: roomId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);

  return prisma.$transaction(async (tx) => {
    const block = await tx.roomBlock.create({
      data: {
        propertyId: actor.propertyId,
        roomId,
        blockType,
        startDate: startOfDay(startDate),
        endDate: endDate ? startOfDay(endDate) : null,
        reason,
        createdBy: actor.userId,
      },
    });

    await writeAuditLog(tx, actor as never, {
      action: 'ROOM_BLOCKED',
      entityType: 'ROOM',
      entityId: roomId,
      metadata: {
        blockId: block.id,
        blockType,
        startDate: block.startDate.toISOString(),
        endDate: block.endDate ? block.endDate.toISOString() : null,
        reason,
      },
    });

    return block;
  });
}

export async function liftRoomBlock({
  actor,
  blockId,
}: {
  actor: { userId: string; propertyId: string; role: string };
  blockId: string;
}) {
  await checkSubscriptionGate(actor, 'room.liftBlock', prisma);
  const block = await prisma.roomBlock.findFirst({
    where: { id: blockId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!block) throw new AppError('ROOM_BLOCK_NOT_FOUND', 'Block not found', 404);

  const room = await prisma.room.findUnique({ where: { id: block.roomId } });
  if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);

  return prisma.$transaction(async (tx) => {
    await tx.roomBlock.update({
      where: { id: blockId },
      data: { deletedAt: new Date(), deletedBy: actor.userId },
    });

    // R4 — a room returning from out-of-order needs a clean before resale.
    await tx.room.update({
      where: { id: room.id },
      data: { housekeepingStatus: 'DIRTY', stateVersion: { increment: 1 } },
    });

    await writeAuditLog(tx, actor as never, {
      action: 'ROOM_BLOCK_LIFTED',
      entityType: 'ROOM',
      entityId: room.id,
      metadata: { blockId, housekeepingStatus: 'DIRTY' },
    });

    return { ok: true };
  });
}

export async function listActiveBlocksForRooms(propertyId: string, roomIds: string[]) {
  if (roomIds.length === 0) return [];
  return prisma.roomBlock.findMany({
    where: {
      propertyId,
      roomId: { in: roomIds },
      deletedAt: null,
      // An active block covers today: started on/before today, and either
      // open-ended (endDate null) or not yet ended.
      OR: [{ endDate: null }, { endDate: { gte: startOfDay(new Date()) } }],
    },
  });
}

export async function isRoomBlockedForRange(roomId: string, checkIn: Date, checkOut: Date) {
  const overlapping = await prisma.roomBlock.findFirst({
    where: {
      roomId,
      deletedAt: null,
      startDate: { lte: checkOut },
      // Open-ended blocks (endDate null) overlap any range starting after them.
      OR: [{ endDate: null }, { endDate: { gte: checkIn } }],
    },
  });
  return overlapping ?? null;
}

/** @gateExempt Cron sweep — system context, no Owner actor. */
export async function sweepExpiredBlocks() {
  const today = startOfDay(new Date());
  // Open-ended blocks (endDate null) never auto-expire — `lt` excludes nulls.
  const expired = await prisma.roomBlock.findMany({
    where: { endDate: { lt: today }, deletedAt: null },
  });

  for (const block of expired) {
    const room = await prisma.room.findUnique({ where: { id: block.roomId } });
    if (!room) continue;
    await prisma.$transaction(async (tx) => {
      await tx.roomBlock.update({
        where: { id: block.id },
        data: { deletedAt: new Date(), deletedBy: 'SYSTEM' },
      });
      // R4 — pre-resale clean once the block lifts.
      await tx.room.update({
        where: { id: room.id },
        data: { housekeepingStatus: 'DIRTY', stateVersion: { increment: 1 } },
      });
      await writeAuditLog(
        tx,
        { userId: 'SYSTEM', propertyId: room.propertyId, role: 'SYSTEM' } as never,
        {
          action: 'ROOM_BLOCK_EXPIRED',
          entityType: 'ROOM',
          entityId: room.id,
          metadata: { blockId: block.id, housekeepingStatus: 'DIRTY' },
        },
      );
    });
  }
  return expired.length;
}
