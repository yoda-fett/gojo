// @ts-nocheck
import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError, roomTypeUpdateSchema } from '@gojo/types';

import { requireRole } from '@/lib/auth/require-role';

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;
    const body = roomTypeUpdateSchema.parse(await req.json());
    const roomType = await prisma.roomType.findFirst({
      where: {
        id,
        propertyId: actor.propertyId,
        deletedAt: null,
      },
    });

    if (!roomType) {
      throw new AppError('NOT_FOUND', 'Room type not found', 404);
    }

    if (roomType.stateVersion !== body.stateVersion) {
      throw new AppError('CONFLICT', 'Room type version mismatch', 409);
    }

    const updated = await prisma.roomType.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        maxOccupancy: body.maxOccupancy,
        baseRate: body.baseRate,
        floorRate: body.floorRate,
        ceilingRate: body.ceilingRate,
        gstSlab: body.gstSlab,
        amenities: body.amenities,
        stateVersion: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'ROOM_TYPE',
        entityId: id,
        action: 'UPDATE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message, ...(error.details ?? {}) }, { status: error.statusCode });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const actor = await requireRole(['OWNER', 'MANAGER'])(req);
    const { id } = await context.params;

    const roomType = await prisma.roomType.findFirst({
      where: {
        id,
        propertyId: actor.propertyId,
        deletedAt: null,
      },
    });

    if (!roomType) {
      throw new AppError('NOT_FOUND', 'Room type not found', 404);
    }

    const activeReservations = await prisma.reservation.count({
      where: {
        roomTypeId: id,
        propertyId: actor.propertyId,
        deletedAt: null,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
    });

    if (activeReservations > 0) {
      throw new AppError('ROOM_TYPE_HAS_ACTIVE_RESERVATIONS', 'Room type has active reservations', 409);
    }

    const deleted = await prisma.roomType.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actor.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'ROOM_TYPE',
        entityId: id,
        action: 'DELETE',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });

    return NextResponse.json(deleted);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message, ...(error.details ?? {}) }, { status: error.statusCode });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
