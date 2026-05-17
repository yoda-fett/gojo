// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { IssueReportClient } from '@/components/issue/IssueReportClient';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function IssuePrefillPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const params = await searchParams;
  const entryContext = first(params.entryContext) === 'DAMAGED_ON_RETURN' ? 'DAMAGED_ON_RETURN' : first(params.entryContext) === 'MISSING_FROM_ROOM' ? 'MISSING_FROM_ROOM' : 'COLD';
  const catalogItemId = first(params.catalogItemId) ?? '';
  const item = catalogItemId
    ? await prisma.catalogItem.findFirst({ where: { id: catalogItemId, propertyId: actor.propertyId, deletedAt: null }, select: { name: true } })
    : null;
  const property = entryContext === 'DAMAGED_ON_RETURN'
    ? await prisma.property.findUnique({ where: { id: actor.propertyId }, select: { laundryVendorName: true } })
    : null;
  const roomId = first(params.roomId) ?? '';
  const returnHref = roomId ? `/room/${roomId}` : '/laundry/receive';

  return (
    <IssueReportClient
      returnHref={returnHref}
      context={{
        entryContext,
        roomId,
        catalogItemId,
        itemName: item?.name ?? null,
        qty: Number(first(params.qtyShort) ?? first(params.qty) ?? '1'),
        vendorName: first(params.vendorName) ?? property?.laundryVendorName ?? 'Laundry vendor',
      }}
    />
  );
}
