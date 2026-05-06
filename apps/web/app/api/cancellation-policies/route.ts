// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';
import { cancellationPolicySchema } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';

export const GET = withAuth(async (_req, actor) => {
  const policies = await prisma.cancellationPolicy.findMany({
    where: {
      propertyId: actor.propertyId,
      deletedAt: null,
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  return NextResponse.json(policies);
}, ['OWNER', 'MANAGER']);

export const POST = withAuth(async (req, actor) => {
  const body = cancellationPolicySchema.parse(await req.json());

  let created;
  if (body.isDefault) {
    await prisma.$transaction(async (tx: typeof prisma) => {
      await tx.cancellationPolicy.updateMany({
        where: {
          propertyId: actor.propertyId,
          deletedAt: null,
          isDefault: true,
        },
        data: { isDefault: false },
      });

      created = await tx.cancellationPolicy.create({
        data: {
          ...body,
          propertyId: actor.propertyId,
        },
      });
    });
  } else {
    created = await prisma.cancellationPolicy.create({
      data: {
        ...body,
        propertyId: actor.propertyId,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'CANCELLATION_POLICY',
      entityId: created.id,
      action: 'CREATE',
      actorId: actor.userId,
      actorRole: actor.role,
    },
  });

  return NextResponse.json(created);
}, ['OWNER', 'MANAGER']);
