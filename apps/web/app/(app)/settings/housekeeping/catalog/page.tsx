// @ts-nocheck
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { CatalogClient } from '@/components/catalog/catalog-client';
import { getServerActor } from '@/lib/auth/server-actor';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== 'OWNER') redirect('/dashboard');

  const params = await searchParams;
  const initialType = params.type === 'linen' ? 'linen' : 'amenity';
  const [roomTypes, items, property] = await Promise.all([
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: [{ itemType: 'asc' }, { name: 'asc' }],
    }),
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: { id: true, laundryVendorName: true, laundryVendorContact: true },
    }),
  ]);

  return (
    <CatalogClient
      initialItems={items as never}
      roomTypes={roomTypes}
      initialType={initialType}
      vendor={{
        propertyId: actor.propertyId,
        laundryVendorName: property?.laundryVendorName ?? null,
        laundryVendorContact: property?.laundryVendorContact ?? null,
      }}
    />
  );
}
