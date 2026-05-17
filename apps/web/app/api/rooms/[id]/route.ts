// @ts-nocheck
// Story 12.7d — Room update + soft-delete.
import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError, roomUpdateSchema } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;
    const body = roomUpdateSchema.parse(await req.json());

    const room = await prisma.room.findFirst({
      where: { id, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);
    if (room.stateVersion !== body.stateVersion) {
      throw new AppError('CONFLICT', 'Room version mismatch', 409);
    }

    // If number changed, check uniqueness.
    if (body.number !== room.number) {
      const dup = await prisma.room.findFirst({
        where: { propertyId: actor.propertyId, number: body.number, deletedAt: null, NOT: { id } },
      });
      if (dup) throw new AppError('ROOM_NUMBER_TAKEN', `Room ${body.number} already exists`, 409);
    }

    const roomType = await prisma.roomType.findFirst({
      where: { id: body.roomTypeId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!roomType) throw new AppError('NOT_FOUND', 'Room type not found', 404);

    const updated = await prisma.room.update({
      where: { id },
      data: {
        number: body.number,
        roomTypeId: body.roomTypeId,
        floor: body.floor ?? null,
        notes: body.notes ?? null,
        accessible: body.accessible,
        connectingRoomId: body.connectingRoomId ?? null,
        stateVersion: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'ROOM',
        entityId: id,
        action: 'UPDATE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message, ...(error.details ?? {}) },
        { status: error.statusCode },
      );
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;

    const room = await prisma.room.findFirst({
      where: { id, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);

    const activeReservations = await prisma.reservation.count({
      where: {
        roomId: id,
        propertyId: actor.propertyId,
        deletedAt: null,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
    });
    if (activeReservations > 0) {
      throw new AppError('ROOM_HAS_ACTIVE_RESERVATIONS', 'Room has active reservations', 409);
    }

    const deleted = await prisma.room.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'ROOM',
        entityId: id,
        action: 'DELETE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json(deleted);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message, ...(error.details ?? {}) },
        { status: error.statusCode },
      );
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
