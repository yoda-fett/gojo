// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { LinenTaskClient } from '@/components/task-client';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LinenSwapPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const { id } = await params;
  const room = await prisma.room.findFirst({ where: { id, propertyId: actor.propertyId, deletedAt: null } });
  if (!room) redirect('/');
  const [items, ownerOpenLog] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, itemType: 'LINEN', linenCategory: 'ROUTINE', deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.laundryLog.findFirst({
      where: { propertyId: actor.propertyId, roomId: id, state: 'ITEMS_OUT', createdByRole: 'OWNER', deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return <LinenTaskClient room={room} items={items.map((item) => ({ ...item, standardQty: 1 }))} category="ROUTINE" ownerOpenLog={ownerOpenLog} />;
}
