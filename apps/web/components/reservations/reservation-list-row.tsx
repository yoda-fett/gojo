'use client';

import Link from 'next/link';

import { StatusChip } from '@/components/reservations/status-chip';
import { Button } from '@/components/ui/button';
import { formatIST } from '@/lib/tz';
import { canPerform } from '@/lib/auth/rbac';

type ReservationRow = {
  id: string;
  bookingReference: string;
  guestName: string;
  guestPhone: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
  sourceLabel: string;
};

export function ReservationListRow({ reservation, role }: { reservation: ReservationRow; role: 'OWNER' | 'MANAGER' | 'FRONT_DESK' }) {
  return (
    <tr className="border-t border-[#edf3f1] align-top text-[13px] text-[var(--color-charcoal)]">
      <td className="py-4 pr-3">
        <Link href={`/reservations/${reservation.id}`} className="font-semibold text-[var(--color-charcoal)] hover:text-[var(--color-teal)]">
          {reservation.bookingReference}
        </Link>
        <p className="mt-1 text-[12px] text-[var(--color-mid-gray)]">{reservation.sourceLabel}</p>
      </td>
      <td className="py-4 pr-3">
        <p className="font-medium">{reservation.guestName}</p>
        <p className="mt-1 text-[12px] text-[var(--color-mid-gray)]">{reservation.guestPhone}</p>
      </td>
      <td className="py-4 pr-3">
        <p className="font-medium">Room {reservation.roomNumber}</p>
        <p className="mt-1 text-[12px] text-[var(--color-mid-gray)]">{reservation.roomType}</p>
      </td>
      <td className="py-4 pr-3">
        <p>{formatIST(reservation.checkIn, 'dd MMM yyyy')}</p>
        <p className="mt-1 text-[12px] text-[var(--color-mid-gray)]">to {formatIST(reservation.checkOut, 'dd MMM yyyy')}</p>
      </td>
      <td className="py-4 pr-3">
        <StatusChip status={reservation.status} />
      </td>
      <td className="py-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" href={`/reservations/${reservation.id}`} className="px-3">
            Open
          </Button>
          {reservation.status === 'ARRIVING_TODAY' || reservation.status === 'CONFIRMED' ? (
            <Button variant="secondary" href={`/reservations/${reservation.id}/check-in`} className="px-3">
              Check In
            </Button>
          ) : null}
          {reservation.status === 'CHECKED_IN' || reservation.status === 'CHECKING_OUT_TODAY' ? (
            <Button variant="secondary" href={`/reservations/${reservation.id}/check-out`} className="px-3">
              Check Out
            </Button>
          ) : null}
          {reservation.status === 'ARRIVING_TODAY' || reservation.status === 'CONFIRMED' ? (
            <Button variant="secondary" href={`/reservations/${reservation.id}`} className="px-3">
              No-Show
            </Button>
          ) : null}
          {canPerform(role, 'reservation.update') || role !== 'FRONT_DESK' ? (
            <>
              <Button variant="ghost" href={`/reservations/${reservation.id}/amend`} className="px-3">
                Amend
              </Button>
              <Button variant="ghost" href={`/reservations/${reservation.id}`} className="px-3">
                Cancel
              </Button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
