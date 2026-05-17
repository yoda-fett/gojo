// @ts-nocheck
// Story 12.7f. List + create rate multipliers (SEASONAL / CHANNEL). Floor
// clamping happens at quote time, not here.
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';
import { rateMultiplierSchema } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';

export const GET = withAuth(async (_req, actor) => {
  const items = await prisma.rateMultiplier.findMany({
    where: { propertyId: actor.propertyId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(items);
}, ['OWNER', 'MANAGER']);

export const POST = withAuth(async (req, actor) => {
  const body = rateMultiplierSchema.parse(await req.json());
  const created = await prisma.rateMultiplier.create({
    data: {
      propertyId: actor.propertyId,
      name: body.name,
      type: body.type,
      multiplier: body.multiplier,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      channel: body.channel ?? null,
      roomTypeIds: body.roomTypeIds,
    },
  });

  await prisma.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'RATE_MULTIPLIER',
      entityId: created.id,
      action: 'CREATE',
      actorId: actor.userId,
      actorRole: actor.role,
    },
  });

  return NextResponse.json(created);
}, ['OWNER', 'MANAGER']);
