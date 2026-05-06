// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';

const schema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  clientVersion: z.number().int(),
  serverVersion: z.number().int(),
});

export const POST = withAuth(async (req, actor) => {
  const body = schema.parse(await req.json());
  await prisma.stateDivergenceEvent.create({
    data: {
      propertyId: actor.propertyId,
      entityType: body.entityType,
      entityId: body.entityId,
      clientVersion: body.clientVersion,
      serverVersion: body.serverVersion,
    },
  });
  return NextResponse.json({ ok: true });
});
