// @ts-nocheck
import { checkSubscriptionGate, prisma, writeAuditLog } from '@gojo/db';
import { AppError } from '@gojo/types';
import { startOfDay } from 'date-fns';

import { transitionRoomState } from './room-state';

const BLOCKABLE_FROM_STATES = new Set(['AVAILABLE', 'DIRTY', 'CLEAN']);

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
  endDate: Date;
  reason: string;
}) {
  await checkSubscriptionGate(actor, 'room.createBlock', prisma);
  if (endDate < startDate) {
    throw new AppError('VALIDATION_ERROR', 'endDate must be on or after startDate', 400);
  }

  const room = await prisma.room.findFirst({
    where: { id: roomId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);

  const today = startOfDay(new Date());
  const blockStartsToday = startOfDay(startDate).getTime() <= today.getTime();

  return prisma.$transaction(async (tx) => {
    const block = await tx.roomBlock.create({
      data: {
        propertyId: actor.propertyId,
        roomId,
        blockType,
        startDate: startOfDay(startDate),
        endDate: startOfDay(endDate),
        reason,
        createdBy: actor.userId,
      },
    });

    if (blockStartsToday && BLOCKABLE_FROM_STATES.has(room.state)) {
      await transitionRoomState(tx, actor, {
        roomId,
        expectedStateVersion: room.stateVersion,
        fromState: room.state,
        toState: blockType,
        action: 'ROOM_BLOCKED',
        metadata: { blockId: block.id, reason, endDate: block.endDate.toISOString() },
      });
    } else {
      await writeAuditLog(tx, actor as never, {
        action: 'ROOM_BLOCKED',
        entityType: 'ROOM',
        entityId: roomId,
        metadata: { blockId: block.id, blockType, startDate: block.startDate.toISOString(), endDate: block.endDate.toISOString(), reason },
      });
    }

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

    if (room.state === block.blockType) {
      await transitionRoomState(tx, actor, {
        roomId: room.id,
        expectedStateVersion: room.stateVersion,
        fromState: room.state,
        toState: 'AVAILABLE',
        action: 'ROOM_BLOCK_LIFTED',
        metadata: { blockId },
      });
    } else {
      await writeAuditLog(tx, actor as never, {
        action: 'ROOM_BLOCK_LIFTED',
        entityType: 'ROOM',
        entityId: room.id,
        metadata: { blockId, currentState: room.state },
      });
    }

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
      endDate: { gte: startOfDay(new Date()) },
    },
  });
}

export async function isRoomBlockedForRange(roomId: string, checkIn: Date, checkOut: Date) {
  const overlapping = await prisma.roomBlock.findFirst({
    where: {
      roomId,
      deletedAt: null,
      startDate: { lte: checkOut },
      endDate: { gte: checkIn },
    },
  });
  return overlapping ?? null;
}

/** @gateExempt Cron sweep — system context, no Owner actor. */
export async function sweepExpiredBlocks() {
  const today = startOfDay(new Date());
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
      if (room.state === block.blockType) {
        await transitionRoomState(
          tx,
          { userId: 'SYSTEM', propertyId: room.propertyId, role: 'SYSTEM' },
          {
            roomId: room.id,
            expectedStateVersion: room.stateVersion,
            fromState: room.state,
            toState: 'AVAILABLE',
            action: 'ROOM_BLOCK_EXPIRED',
            metadata: { blockId: block.id },
          },
        );
      }
    });
  }
  return expired.length;
}
