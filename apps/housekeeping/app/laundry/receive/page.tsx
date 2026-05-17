// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { LaundryReceiveClient } from '@/components/task-client';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LaundryReceivePage() {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const [property, outgoing] = await Promise.all([
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { laundryVendorName: true, laundryVendorContact: true } }),
    prisma.laundryLogItem.findMany({ where: { propertyId: actor.propertyId, state: 'ITEMS_OUT', remainingQty: { gt: 0 } } }),
  ]);
  const itemIds = Array.from(new Set(outgoing.map((item) => item.catalogItemId)));
  const catalog = await prisma.catalogItem.findMany({ where: { id: { in: itemIds }, propertyId: actor.propertyId, deletedAt: null } });
  const catalogMap = new Map(catalog.map((item) => [item.id, item]));
  const totals = new Map<string, number>();
  for (const item of outgoing) totals.set(item.catalogItemId, (totals.get(item.catalogItemId) ?? 0) + item.remainingQty);
  const snapshot = {
    vendorName: property?.laundryVendorName ?? 'Laundry vendor',
    vendorContact: property?.laundryVendorContact ?? null,
    openCycleCount: new Set(outgoing.map((item) => item.laundryLogId)).size,
    items: Array.from(totals.entries()).map(([catalogItemId, expectedBack]) => {
      const item = catalogMap.get(catalogItemId);
      return { catalogItemId, name: item?.name ?? catalogItemId, unit: item?.unit ?? 'piece', linenCategory: item?.linenCategory ?? null, expectedBack };
    }),
  };
  return <LaundryReceiveClient snapshot={snapshot} />;
}
