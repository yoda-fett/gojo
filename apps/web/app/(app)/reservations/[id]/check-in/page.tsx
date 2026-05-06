// @ts-nocheck
import { Topbar } from '@/components/layout/topbar';
import { CheckInForm } from '@/components/reservations/check-in-form';
import { getServerActor } from '@/lib/auth/server-actor';
import { getReservationDetail } from '@/lib/services/reservation-service';

type Context = { params: Promise<{ id: string }> };

export default async function ReservationCheckInPage({ params }: Context) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER', 'FRONT_DESK'].includes(actor.role)) {
    return null;
  }

  const { id } = await params;
  const reservation = await getReservationDetail(actor, id);

  return (
    <div>
      <Topbar title="Check In" subtitle={reservation.bookingReference} />
      <div className="px-4 py-[28px] sm:px-8">
        <CheckInForm reservation={reservation} />
      </div>
    </div>
  );
}
