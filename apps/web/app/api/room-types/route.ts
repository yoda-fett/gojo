// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError, roomTypeCreateSchema } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';

export const GET = withAuth(async (_req, actor) => {
  const roomTypes = await prisma.roomType.findMany({
    where: {
      propertyId: actor.propertyId,
      deletedAt: null,
    },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(roomTypes);
}, ['OWNER', 'MANAGER']);

export const POST = withAuth(async (req, actor) => {
  const body = roomTypeCreateSchema.parse(await req.json());
  if (body.ceilingRate && body.floorRate > body.ceilingRate) {
    throw new AppError('INVALID_RATE_RANGE', 'floorRate must be <= ceilingRate', 422);
  }

  const created = await prisma.roomType.create({
    data: {
      ...body,
      propertyId: actor.propertyId,
    },
  });

  await prisma.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'ROOM_TYPE',
      entityId: created.id,
      action: 'CREATE',
      actorId: actor.userId,
      actorRole: actor.role,
      metadata: { name: created.name },
    },
  });

  return NextResponse.json(created);
}, ['OWNER', 'MANAGER']);
