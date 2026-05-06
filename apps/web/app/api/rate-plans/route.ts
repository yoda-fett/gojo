// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError, ratePlanSchema } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';

export const GET = withAuth(async (_req, actor) => {
  const ratePlans = await prisma.ratePlan.findMany({
    where: {
      propertyId: actor.propertyId,
      deletedAt: null,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(ratePlans);
}, ['OWNER', 'MANAGER']);

export const POST = withAuth(async (req, actor) => {
  const body = ratePlanSchema.parse(await req.json());
  const roomType = await prisma.roomType.findFirst({
    where: {
      id: body.roomTypeId,
      propertyId: actor.propertyId,
      deletedAt: null,
    },
  });

  if (!roomType) {
    throw new AppError('PROPERTY_ACCESS_DENIED', 'Room type does not belong to this property', 403);
  }

  const created = await prisma.ratePlan.create({
    data: {
      ...body,
      propertyId: actor.propertyId,
    },
  });

  await prisma.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'RATE_PLAN',
      entityId: created.id,
      action: 'CREATE',
      actorId: actor.userId,
      actorRole: actor.role,
    },
  });

  return NextResponse.json(created);
}, ['OWNER', 'MANAGER']);
