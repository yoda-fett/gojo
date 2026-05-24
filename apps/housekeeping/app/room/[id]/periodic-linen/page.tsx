// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { LinenTaskClient } from '@/components/task-client';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PeriodicLinenPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const { id } = await params;
  const room = await prisma.room.findFirst({ where: { id, propertyId: actor.propertyId, deletedAt: null } });
  if (!room) redirect('/');
  const [items, roomType, lastDoneLog] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, itemType: 'LINEN', linenCategory: 'PERIODIC', deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    room.roomTypeId
      ? prisma.roomType.findUnique({ where: { id: String(room.roomTypeId) }, select: { name: true } })
      : Promise.resolve(null),
    // Most recent completed periodic-linen log for this property+room — fills
    // the context strip's "Last done: …" line (wireframe 07).
    prisma.laundryLog.findFirst({
      where: {
        propertyId: actor.propertyId,
        roomId: id,
        linenCategory: 'PERIODIC',
        closedAt: { not: null },
        deletedAt: null,
      },
      orderBy: { closedAt: 'desc' },
      select: { closedAt: true },
    }),
  ]);
  const lastDoneIso = lastDoneLog?.closedAt ? new Date(String(lastDoneLog.closedAt)).toISOString() : null;
  return (
    <LinenTaskClient
      room={room}
      roomTypeName={roomType?.name ? String(roomType.name) : undefined}
      items={items.map((item) => ({ ...item, standardQty: 1 }))}
      category="PERIODIC"
      periodicContext={{ cadenceLabel: 'Periodic', lastDoneIso }}
    />
  );
}
