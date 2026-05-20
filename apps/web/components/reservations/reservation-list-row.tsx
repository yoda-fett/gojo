'use client';

import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';

import { ExpandedReservation } from '@/components/reservations/expanded-reservation';
import { StatusChip } from '@/components/reservations/status-chip';
import { formatIST } from '@/lib/tz';

type ReservationSource = string;

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

const COLUMN_COUNT = 9;

// Compact source pill. The shared <Chip> primitive sized for KPI cards is
// oversized inside a dense table — render as a tighter inline span here.
function sourcePillStyles(source: ReservationSource): string {
  if (source === 'DIRECT_BOOKING') return 'bg-[rgba(29,168,136,0.12)] text-[var(--color-teal-dark)]';
  if (source === 'WALK_IN') return 'bg-[rgba(158,174,172,0.18)] text-[var(--color-charcoal)]';
  return 'bg-[rgba(233,196,106,0.18)] text-[#8a6610]'; // OTA + any other
}

export function ReservationListRow({
  reservation,
  expanded,
  role,
  onToggle,
  onOpenHistory,
  onOpenFolio,
  onOpenAmend,
}: {
  reservation: ReservationRow;
  expanded: boolean;
  role: 'OWNER' | 'MANAGER' | 'FRONT_DESK';
  onToggle: () => void;
  onOpenHistory: () => void;
  onOpenFolio: () => void;
  onOpenAmend: () => void;
}) {
  const rowRef = useRef<HTMLTableRowElement | null>(null);

  // When a row expands — including a deep-link landing or a just-created
  // reservation — bring it into view so the change is visible above the fold.
  useEffect(() => {
    if (expanded) {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [expanded]);

  return (
    <>
      <tr
        ref={rowRef}
        onClick={onToggle}
        aria-expanded={expanded}
        className={`cursor-pointer border-t border-[#edf3f1] align-middle text-[12.5px] font-normal text-[var(--color-charcoal)] ${
          expanded ? 'bg-[#f0faf7]' : 'hover:bg-[var(--color-off-white)]'
        }`}
      >
        <td className={`px-3 py-2.5 pr-3 ${expanded ? 'shadow-[inset_3px_0_0_var(--color-teal)]' : ''}`}>
          <span className={`text-[12.5px] text-[var(--color-charcoal)] ${expanded ? 'font-bold' : 'font-medium'}`}>
            {reservation.bookingReference}
          </span>
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
          <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-md">
            <ChevronRight
              className={`transition-transform ${
                expanded ? 'size-[18px] rotate-90 text-[var(--color-teal)]' : 'size-4 text-[var(--color-mid-gray)]'
              }`}
              strokeWidth={expanded ? 3 : 2}
            />
          </span>
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={COLUMN_COUNT} className="border-y border-[#e8efee] bg-[#fafcfc] p-0">
            <ExpandedReservation
              reservationId={reservation.id}
              role={role}
              onOpenHistory={onOpenHistory}
              onOpenFolio={onOpenFolio}
              onOpenAmend={onOpenAmend}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}
