// @ts-nocheck
import Link from 'next/link';

import { prisma } from '@gojo/db';

import { Topbar } from '@/components/layout/topbar';
import { ReservationWorkspace } from '@/components/reservations/reservation-workspace';
import { getServerActor } from '@/lib/auth/server-actor';
import { listReservations } from '@/lib/services/reservation-service';

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER', 'FRONT_DESK'].includes(actor.role)) {
    return null;
  }

  const params = (await searchParams) ?? {};
  const status = typeof params.status === 'string' ? [params.status] : Array.isArray(params.status) ? params.status : [];
  const source = typeof params.source === 'string' ? [params.source] : Array.isArray(params.source) ? params.source : [];
  const roomType = typeof params.roomType === 'string' ? [params.roomType] : Array.isArray(params.roomType) ? params.roomType : [];
  const from = typeof params.from === 'string' ? params.from : undefined;
  const to = typeof params.to === 'string' ? params.to : undefined;

  const [initialData, roomTypes] = await Promise.all([
    listReservations(actor, {
      status,
      source,
      roomType,
      from,
      to,
    }),
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <Topbar
        title="Bookings"
        subtitle="Unified front-desk register across direct, walk-in, and OTA reservations"
        controls={(
          <Link
            href="/reservations/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: '#1DA888',
              color: '#fff',
              textDecoration: 'none',
              border: '1px solid #1DA888',
            }}
            className="hover:!bg-[#0A6B58] hover:!border-[#0A6B58]"
          >
            + Booking
          </Link>
        )}
      />
      <ReservationWorkspace
        role={actor.role}
        initialFilters={{
          q: typeof params.q === 'string' ? params.q : undefined,
          status: status[0],
          source: source[0],
          roomType: roomType[0],
          from,
          to,
        }}
        roomTypes={roomTypes}
        initialData={initialData}
      />
    </div>
  );
}
