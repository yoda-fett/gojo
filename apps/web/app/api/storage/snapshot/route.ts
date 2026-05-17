// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

function bandFor(totalOwned: number | null) {
  const inStorage = totalOwned ?? 0;
  if (inStorage <= 0) return 'EMPTY';
  if (inStorage <= Math.ceil((totalOwned ?? 0) * 0.2)) return 'LOW';
  return 'HEALTHY';
}

export const GET = withAuth(async (_req, actor) => {
  const items = await prisma.catalogItem.findMany({
    where: { propertyId: actor.propertyId, itemType: 'LINEN', deletedAt: null },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      catalogItemId: item.id,
      name: item.name,
      unit: item.unit,
      inStorage: item.totalOwned ?? 0,
      band: bandFor(item.totalOwned),
      linenCategory: item.linenCategory,
    })),
  });
}, 'HOUSEKEEPING');
