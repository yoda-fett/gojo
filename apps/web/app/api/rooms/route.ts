// @ts-nocheck
// Story 12.7d — Room CRUD surface (list + single create + range create).
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError, roomCreateSchema, roomRangeCreateSchema } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';

export const GET = withAuth(async (_req, actor) => {
  const rooms = await prisma.room.findMany({
    where: { propertyId: actor.propertyId, deletedAt: null },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });
  return NextResponse.json(rooms);
}, ['OWNER', 'MANAGER']);

// POST /api/rooms — body shape decides single vs range.
// Single:  { number, roomTypeId, floor?, notes?, accessible?, connectingRoomId? }
// Range:   { start, end, prefix?, suffix?, pad?, roomTypeId, floor?, accessible? }
export const POST = withAuth(async (req, actor) => {
  const json = await req.json();
  const isRange = typeof json?.start === 'number' && typeof json?.end === 'number';

  if (isRange) {
    const body = roomRangeCreateSchema.parse(json);
    const roomType = await prisma.roomType.findFirst({
      where: { id: body.roomTypeId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!roomType) throw new AppError('NOT_FOUND', 'Room type not found', 404);

    const numbers: string[] = [];
    for (let n = body.start; n <= body.end; n++) {
      const padded = body.pad ? String(n).padStart(body.pad, '0') : String(n);
      numbers.push(`${body.prefix ?? ''}${padded}${body.suffix ?? ''}`);
    }

    // AC3: gracefully skip already-existing numbers.
    const existing = await prisma.room.findMany({
      where: { propertyId: actor.propertyId, number: { in: numbers } },
      select: { number: true },
    });
    const skip = new Set(existing.map((r) => r.number));
    const toCreate = numbers.filter((n) => !skip.has(n));

    const created = await prisma.$transaction(
      toCreate.map((number) =>
        prisma.room.create({
          data: {
            propertyId: actor.propertyId,
            roomTypeId: body.roomTypeId,
            number,
            floor: body.floor ?? null,
            state: 'AVAILABLE',
            accessible: body.accessible,
          },
        }),
      ),
    );

    if (created.length > 0) {
      await prisma.auditLog.createMany({
        data: created.map((room) => ({
          propertyId: actor.propertyId,
          entityType: 'ROOM',
          entityId: room.id,
          action: 'CREATE',
          actorId: actor.userId,
          actorRole: actor.role,
          metadata: { number: room.number, viaRange: true },
        })),
      });
    }

    return NextResponse.json({
      created,
      skipped: numbers.filter((n) => skip.has(n)),
    });
  }

  const body = roomCreateSchema.parse(json);
  const roomType = await prisma.roomType.findFirst({
    where: { id: body.roomTypeId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!roomType) throw new AppError('NOT_FOUND', 'Room type not found', 404);

  const dup = await prisma.room.findFirst({
    where: { propertyId: actor.propertyId, number: body.number, deletedAt: null },
  });
  if (dup) throw new AppError('ROOM_NUMBER_TAKEN', `Room ${body.number} already exists`, 409);

  const created = await prisma.room.create({
    data: {
      propertyId: actor.propertyId,
      roomTypeId: body.roomTypeId,
      number: body.number,
      floor: body.floor ?? null,
      notes: body.notes ?? null,
      accessible: body.accessible,
      connectingRoomId: body.connectingRoomId ?? null,
      state: 'AVAILABLE',
    },
  });

  await prisma.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'ROOM',
      entityId: created.id,
      action: 'CREATE',
      actorId: actor.userId,
      actorRole: actor.role,
      metadata: { number: created.number },
    },
  });

  return NextResponse.json(created);
}, ['OWNER', 'MANAGER']);
