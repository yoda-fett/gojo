'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { StatusChip } from '@/components/reservations/status-chip';
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

// Compact source pill. The shared <Chip> primitive sized for KPI cards is
// oversized inside a dense table — render as a tighter inline span here.
function sourcePillStyles(source: ReservationSource): string {
  if (source === 'DIRECT_BOOKING') return 'bg-[rgba(29,168,136,0.12)] text-[var(--color-teal-dark)]';
  if (source === 'WALK_IN') return 'bg-[rgba(158,174,172,0.18)] text-[var(--color-charcoal)]';
  return 'bg-[rgba(233,196,106,0.18)] text-[#8a6610]'; // OTA + any other
}

export function ReservationListRow({ reservation }: { reservation: ReservationRow }) {
  const detailHref = `/reservations/${reservation.id}`;
  return (
    <tr className="border-t border-[#edf3f1] align-middle text-[12.5px] font-normal text-[var(--color-charcoal)] hover:bg-[var(--color-off-white)]">
      <td className="py-2.5 pr-3">
        <Link href={detailHref} className="text-[12.5px] font-medium text-[var(--color-charcoal)] hover:text-[var(--color-teal)]">
          {reservation.bookingReference}
        </Link>
      </td>
      <td className="py-2.5 pr-3">
        <p className="text-[12.5px] font-medium text-[var(--color-charcoal)]">{reservation.guestName}</p>
        <p className="mt-0.5 text-[11.5px] font-normal text-[var(--color-mid-gray)]">{reservation.guestPhone}</p>
      </td>
      <td className="py-2.5 pr-3 text-[12.5px] text-[var(--color-mid-gray)]">{reservation.roomType}</td>
      <td className="py-2.5 pr-3 whitespace-nowrap text-[12.5px] text-[var(--color-mid-gray)]">{formatIST(reservation.checkIn, 'dd MMM yyyy')}</td>
      <td className="py-2.5 pr-3 whitespace-nowrap text-[12.5px] text-[var(--color-mid-gray)]">{formatIST(reservation.checkOut, 'dd MMM yyyy')}</td>
      <td className="py-2.5 pr-3 text-center text-[12.5px] font-medium text-[var(--color-charcoal)]">{reservation.nights}</td>
      <td className="py-2.5 pr-3">
        <span className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${sourcePillStyles(reservation.source)}`}>
          {reservation.sourceLabel}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <StatusChip status={reservation.status} />
      </td>
      <td className="py-2.5 text-right">
        <Link
          href={detailHref}
          aria-label={`Open booking ${reservation.bookingReference}`}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-[var(--color-mid-gray)] hover:bg-[var(--color-line-soft)] hover:text-[var(--color-teal)]"
        >
          <ChevronRight className="size-4" />
        </Link>
      </td>
    </tr>
  );
}
