// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';

import { withAuth } from '@/lib/auth/api-handler';

export const GET = withAuth(async (_req, actor) => {
  const accessList = await prisma.propertyAccess.findMany({
    where: {
      userId: actor.userId,
      status: 'ACTIVE',
      revokedAt: null,
      deletedAt: null,
    },
  });

  const properties = await Promise.all(
    accessList.map(async (access: { propertyId: string; role: string; status: string }) => {
      const property = await prisma.property.findUnique({ where: { id: access.propertyId } });
      return {
        propertyId: access.propertyId,
        propertyName: property?.name ?? access.propertyId,
        role: access.role,
        status: access.status,
      };
    }),
  );

  properties.sort((left: { propertyName: string; role: string }, right: { propertyName: string; role: string }) => {
    if (left.role === right.role) {
      return left.propertyName.localeCompare(right.propertyName);
    }

    return left.role === 'OWNER' ? -1 : 1;
  });

  return NextResponse.json(properties);
});
