// @ts-nocheck
// Story 12.5 — Cold-Start Linen Distribution sub-flow. Lives outside the
// `/onboarding` shell as its own page so the URL is bookmarkable for re-entry
// after deferral. The page guards on:
//   - actor exists (sign-in redirect)
//   - cold-start not yet completed (redirect to /dashboard if it is)
//   - at least one LINEN catalog item exists (back to /onboarding otherwise)
import { prisma } from '@gojo/db';
import { redirect } from 'next/navigation';

import { getServerActor } from '@/lib/auth/server-actor';

import { LinenDistributionClient } from './_components/linen-distribution-client';

export const dynamic = 'force-dynamic';

export default async function LinenDistributionPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; mode?: string }>;
}) {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');
  const params = await searchParams;
  const isolatedItemId = params.item ?? null;
  const startMode = params.mode === 'per-room' ? 'per-room' : null;

  const [property, linens, rooms, states] = await Promise.all([
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: { coldStartCompletedAt: true, coldStartLinenDeferred: true },
    }),
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, itemType: 'LINEN', deletedAt: null },
      orderBy: [{ linenCategory: 'asc' }, { name: 'asc' }],
    }),
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true, number: true, roomTypeId: true, floor: true },
      orderBy: [{ number: 'asc' }],
    }),
    prisma.roomLinenState.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { catalogItemId: true, qty: true },
    }),
  ]);

  if (!property) return null;
  if (property.coldStartCompletedAt) redirect('/dashboard');
  if (linens.length === 0) redirect('/onboarding');

  const inRoomsByItem = new Map<string, number>();
  for (const s of states) {
    inRoomsByItem.set(s.catalogItemId, (inRoomsByItem.get(s.catalogItemId) ?? 0) + s.qty);
  }

  // AC4 isolated mode: when ?item=<id> is passed (deep-link from the 12.6
  // reconciliation report), render only that item's card with the prior
  // declaration pre-filled. ?mode=per-room opens the manual override grid.
  const allItems = linens.map((l) => ({
    id: l.id,
    name: l.name,
    unit: l.unit,
    linenCategory: l.linenCategory ?? null,
    roomTypeId: l.roomTypeId ?? null,
    totalOwned: l.totalOwned ?? 0,
    inRoomsSoFar: inRoomsByItem.get(l.id) ?? 0,
  }));
  const visibleItems = isolatedItemId
    ? allItems.filter((i) => i.id === isolatedItemId)
    : allItems;
  if (isolatedItemId && visibleItems.length === 0) redirect('/onboarding/linen-distribution');

  return (
    <LinenDistributionClient
      alreadyDeferred={property.coldStartLinenDeferred ?? false}
      isolatedItemId={isolatedItemId}
      startMode={startMode}
      items={visibleItems}
      rooms={rooms.map((r) => ({ id: r.id, number: r.number, roomTypeId: r.roomTypeId, floor: r.floor }))}
    />
  );
}
