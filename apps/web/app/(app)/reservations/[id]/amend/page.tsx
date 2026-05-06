// @ts-nocheck
import { prisma } from '@gojo/db';

import { Topbar } from '@/components/layout/topbar';
import { AmendReservationForm } from '@/components/reservations/amend-reservation-form';
import { getServerActor } from '@/lib/auth/server-actor';
import { getReservationDetail } from '@/lib/services/reservation-service';

type Context = { params: Promise<{ id: string }> };

export default async function AmendReservationPage({ params }: Context) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER'].includes(actor.role)) {
    return null;
  }

  const { id } = await params;
  const [reservation, roomTypes] = await Promise.all([
    getReservationDetail(actor, id),
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div>
      <Topbar title="Amend Reservation" subtitle={reservation.bookingReference} />
      <div className="px-4 py-[28px] sm:px-8">
        <AmendReservationForm reservation={reservation} roomTypes={roomTypes.map((roomType) => ({ id: roomType.id, name: roomType.name, floorRate: Number(roomType.floorRate), ceilingRate: roomType.ceilingRate ? Number(roomType.ceilingRate) : null }))} />
      </div>
    </div>
  );
}
