// @ts-nocheck
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@gojo/db';

import { PwaShell } from '@/components/pwa-shell';
import { readHousekeepingActor } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await readHousekeepingActor(await cookies());
  if (!actor) redirect('/sign-in');
  const { id } = await params;
  const room = await prisma.room.findFirst({
    where: { id, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!room) redirect('/');

  return (
    <PwaShell title={`Room ${room.number}`} nav={false}>
      <section className="hk-card" style={{ padding: 18 }}>
        <p style={{ margin: 0, color: '#66736F', fontSize: 13 }}>Housekeeping status</p>
        <h2 style={{ margin: '4px 0 16px', fontSize: 28 }}>{room.housekeepingStatus}</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          <a className="hk-button" href={`/room/${room.id}/clean`} style={{ display: 'grid', placeItems: 'center' }}>Clean task</a>
          <a className="hk-button" href={`/room/${room.id}/refill`} style={{ display: 'grid', placeItems: 'center', background: '#E7F4F1', color: '#127C69' }}>Refill task</a>
          <a className="hk-button" href={`/room/${room.id}/linen-swap`} style={{ display: 'grid', placeItems: 'center', background: '#F7EEDF', color: '#8A5B10' }}>Linen swap</a>
          <a className="hk-button" href={`/room/${room.id}/periodic-linen`} style={{ display: 'grid', placeItems: 'center', background: '#F3E8FF', color: '#6B21A8' }}>Periodic linen</a>
          <a className="hk-button" href={`/room/${room.id}/issue`} style={{ display: 'grid', placeItems: 'center', background: '#FFF7ED', color: '#B7791F' }}>Report an issue</a>
        </div>
      </section>
    </PwaShell>
  );
}
