import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';

import { readHousekeepingActor } from '@/lib/auth';
import { bandForInStorage } from '@/lib/inventory-band';

export async function GET() {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const items = await prisma.catalogItem.findMany({
    where: { propertyId: actor.propertyId, itemType: 'LINEN', deletedAt: null },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    items: items.map((item) => {
      const totalOwned = Number(item.totalOwned ?? 0);
      const inStorage = totalOwned;
      return {
        catalogItemId: String(item.id),
        name: String(item.name),
        unit: String(item.unit),
        inStorage,
        band: bandForInStorage(inStorage, totalOwned),
        linenCategory: item.linenCategory,
      };
    }),
  });
}
