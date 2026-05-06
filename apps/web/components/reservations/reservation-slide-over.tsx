'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { StatusChip } from '@/components/reservations/status-chip';
import { formatIST } from '@/lib/tz';

export function ReservationSlideOver({
  reservation,
  onClose,
}: {
  reservation: {
    id: string;
    bookingReference: string;
    guestName: string;
    roomNumber: string;
    roomType: string;
    status: string;
    source: string;
    checkIn: string;
    checkOut: string;
  } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!reservation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-[rgba(16,33,28,0.4)]" onClick={onClose}>
      <aside
        role="dialog"
        aria-labelledby="reservation-slide-over-title"
        className="absolute right-0 top-0 h-full w-[min(360px,92vw)] bg-white p-6 shadow-[0_12px_40px_rgba(16,33,28,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Reservation</p>
            <h2 id="reservation-slide-over-title" className="mt-2 text-[20px] font-semibold text-[var(--color-charcoal)]">{reservation.bookingReference}</h2>
          </div>
          <button type="button" className="min-h-11 min-w-11 rounded-[8px] border border-[#d7e3e0]" onClick={onClose}>Close</button>
        </div>
        <div className="mt-6 space-y-4 text-[13px]">
          <StatusChip status={reservation.status} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Guest</p>
            <p className="mt-1 font-semibold">{reservation.guestName}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Stay</p>
            <p className="mt-1">{formatIST(reservation.checkIn, 'dd MMM yyyy')} to {formatIST(reservation.checkOut, 'dd MMM yyyy')}</p>
            <p className="mt-1 text-[var(--color-mid-gray)]">Room {reservation.roomNumber} • {reservation.roomType}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Source</p>
            <p className="mt-1">{reservation.source}</p>
          </div>
          <Link href={`/reservations/${reservation.id}`} className="inline-flex text-[14px] font-semibold text-[var(--color-teal)]">
            View full details →
          </Link>
        </div>
      </aside>
    </div>
  );
}
