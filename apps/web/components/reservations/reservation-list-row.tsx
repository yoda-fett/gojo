'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { StatusChip } from '@/components/reservations/status-chip';
import { Chip } from '@/components/ui/chip';
import { formatIST } from '@/lib/tz';

type ReservationSource = 'WALK_IN' | 'DIRECT_BOOKING' | 'OTA' | string;

export type ReservationRow = {
  id: string;
  bookingReference: string;
  guestName: string;
  guestPhone: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
  source: ReservationSource;
  sourceLabel: string;
  nights: number;
};

function sourceVariant(source: ReservationSource): 'positive' | 'neutral' | 'caution' {
  if (source === 'DIRECT_BOOKING') return 'positive';
  if (source === 'WALK_IN') return 'neutral';
  return 'caution'; // OTA + any other
}

export function ReservationListRow({ reservation }: { reservation: ReservationRow }) {
  const detailHref = `/reservations/${reservation.id}`;
  return (
    <tr className="border-t border-[#edf3f1] align-middle text-[13px] text-[var(--color-charcoal)] hover:bg-[var(--color-off-white)]">
      <td className="py-3 pr-3">
        <Link href={detailHref} className="font-semibold text-[var(--color-charcoal)] hover:text-[var(--color-teal)]">
          {reservation.bookingReference}
        </Link>
      </td>
      <td className="py-3 pr-3">
        <p className="font-medium">{reservation.guestName}</p>
        <p className="mt-0.5 text-[12px] text-[var(--color-mid-gray)]">{reservation.guestPhone}</p>
      </td>
      <td className="py-3 pr-3">{reservation.roomType}</td>
      <td className="py-3 pr-3 whitespace-nowrap">{formatIST(reservation.checkIn, 'dd MMM yyyy')}</td>
      <td className="py-3 pr-3 whitespace-nowrap">{formatIST(reservation.checkOut, 'dd MMM yyyy')}</td>
      <td className="py-3 pr-3">{reservation.nights}</td>
      <td className="py-3 pr-3">
        <Chip variant={sourceVariant(reservation.source)}>{reservation.sourceLabel}</Chip>
      </td>
      <td className="py-3 pr-3">
        <StatusChip status={reservation.status} />
      </td>
      <td className="py-3 text-right">
        <Link
          href={detailHref}
          aria-label={`Open booking ${reservation.bookingReference}`}
          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--color-mid-gray)] hover:bg-[var(--color-line-soft)] hover:text-[var(--color-teal)]"
        >
          <ChevronRight className="size-4" />
        </Link>
      </td>
    </tr>
  );
}
