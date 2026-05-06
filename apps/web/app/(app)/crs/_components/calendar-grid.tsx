// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';

import { ReservationSlideOver } from '@/components/reservations/reservation-slide-over';
import { formatISTDateKey } from '@/lib/tz';

function buildDates(from: string, to: string) {
  const dates: string[] = [];
  let cursor = new Date(`${from}T00:00:00+05:30`);
  const end = new Date(`${to}T00:00:00+05:30`);

  while (cursor <= end) {
    dates.push(formatISTDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateMeta(dateKey: string) {
  const [yyyy, mm, dd] = dateKey.split('-').map(Number);
  const d = new Date(yyyy ?? 1970, (mm ?? 1) - 1, dd ?? 1);
  return { letter: WEEKDAY_LETTERS[d.getDay()] ?? '', day: d.getDate() };
}

function compareRooms(a: any, b: any) {
  const an = String(a.roomNumber ?? '');
  const bn = String(b.roomNumber ?? '');
  const aNum = /^\d+$/.test(an) ? Number(an) : null;
  const bNum = /^\d+$/.test(bn) ? Number(bn) : null;
  if (aNum != null && bNum != null) return aNum - bNum;
  if (aNum != null) return -1; // numeric rooms come before non-numeric
  if (bNum != null) return 1;
  return an.localeCompare(bn);
}

function deriveStatus(reservation) {
  if (reservation.hasConflict) return 'NO_SHOW';
  return reservation.status;
}

function spanClasses(reservation) {
  if (reservation.hasConflict) return 'bg-[var(--color-coral)] text-white';
  if (reservation.status === 'CHECKED_IN') return 'bg-[var(--color-charcoal)] text-white';
  if (reservation.status === 'CHECKED_OUT') return 'bg-[var(--color-mid-gray)] text-white';
  return 'bg-[var(--color-teal)] text-white';
}

export function CalendarGrid({ rooms, from, to }: { rooms: any[]; from: string; to: string }) {
  const [selected, setSelected] = useState<any | null>(null);
  const dates = useMemo(() => buildDates(from, to), [from, to]);
  const sortedRooms = useMemo(() => [...(rooms ?? [])].sort(compareRooms), [rooms]);

  return (
    <>
      <div className="overflow-x-auto rounded-[12px] bg-white shadow-[0_1px_3px_rgba(26,43,46,0.05)]">
        <div
          className="grid min-w-[1100px]"
          style={{ gridTemplateColumns: `140px repeat(${dates.length}, minmax(56px, 1fr))` }}
        >
          <div className="sticky left-0 z-10 border-b border-r border-[#edf3f1] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">
            Room
          </div>
          {dates.map((date) => {
            const meta = dateMeta(date);
            return (
              <div key={date} className="flex flex-col items-center gap-0.5 border-b border-l border-[#edf3f1] px-1 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">{meta.letter}</span>
                <span className="text-[11px] font-semibold text-[var(--color-charcoal)]">{meta.day}</span>
              </div>
            );
          })}

          {sortedRooms.map((room) => (
            <div key={room.roomId} className="contents">
              <div className="sticky left-0 z-10 border-b border-r border-[#edf3f1] bg-white px-3 py-3">
                <p className="text-[12px] font-semibold text-[var(--color-charcoal)]">{room.roomNumber}</p>
                <p className="mt-0.5 text-[10px] text-[var(--color-mid-gray)]">{room.roomType}</p>
              </div>
              {dates.map((date) => {
                const reservation = room.reservations.find((entry) => date >= entry.checkIn.slice(0, 10) && date < entry.checkOut.slice(0, 10));
                return (
                  <div key={`${room.roomId}-${date}`} className="min-h-[56px] border-b border-l border-[#edf3f1] bg-[#fbfdfc] p-0.5">
                    {reservation ? (
                      <button
                        type="button"
                        className={`flex h-full w-full flex-col items-start justify-center rounded-[6px] px-1.5 py-1 text-left text-[10px] font-semibold ${spanClasses(reservation)}`}
                        onClick={() => setSelected({
                          ...reservation,
                          status: deriveStatus(reservation),
                        })}
                      >
                        <span className="max-w-full truncate">{reservation.hasConflict ? `! ${reservation.guestName}` : reservation.guestName}</span>
                        <span className="mt-0.5 text-[9px] opacity-80">{reservation.bookingReference}</span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ReservationSlideOver reservation={selected} onClose={() => setSelected(null)} />
    </>
  );
}
