// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { RefillTaskClient } from '@/components/task-client';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RefillPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const { id } = await params;
  const room = await prisma.room.findFirst({ where: { id, propertyId: actor.propertyId, deletedAt: null } });
  if (!room) redirect('/');
  const items = await prisma.catalogItem.findMany({
    where: { propertyId: actor.propertyId, itemType: 'AMENITY', roomTypeId: room.roomTypeId, deletedAt: null },
    orderBy: { name: 'asc' },
  });
  return <RefillTaskClient room={room} items={items} />;
}
