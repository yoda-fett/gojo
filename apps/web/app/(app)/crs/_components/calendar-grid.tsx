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

function todayKey() {
  return formatISTDateKey(new Date());
}

function compareRooms(a: any, b: any) {
  const an = String(a.roomNumber ?? '');
  const bn = String(b.roomNumber ?? '');
  const aNum = /^\d+$/.test(an) ? Number(an) : null;
  const bNum = /^\d+$/.test(bn) ? Number(bn) : null;
  if (aNum != null && bNum != null) return aNum - bNum;
  if (aNum != null) return -1;
  if (bNum != null) return 1;
  return an.localeCompare(bn);
}

function deriveStatus(reservation) {
  if (reservation.hasConflict) return 'NO_SHOW';
  return reservation.status;
}

// Pastel palette per the wireframe — each reservation gets a stable color so
// repeated stays for the same guest don't shift hue across views.
const RESERVATION_PALETTE = [
  { bar: 'bg-[#E3F4EC]', text: 'text-[#1F7A55]', accent: 'bg-[#3DAE92]' },
  { bar: 'bg-[#FBE6DA]', text: 'text-[#B85A28]', accent: 'bg-[#E8763F]' },
  { bar: 'bg-[#E2ECFB]', text: 'text-[#3265B0]', accent: 'bg-[#5A8FE0]' },
  { bar: 'bg-[#F8DDE3]', text: 'text-[#B83A6F]', accent: 'bg-[#D4598B]' },
  { bar: 'bg-[#F5E7CF]', text: 'text-[#9B6A20]', accent: 'bg-[#C9942F]' },
  { bar: 'bg-[#E6EFD9]', text: 'text-[#5C7A2C]', accent: 'bg-[#8AAE45]' },
  { bar: 'bg-[#F6E2F1]', text: 'text-[#8E3E84]', accent: 'bg-[#B868AB]' },
  { bar: 'bg-[#DCEDED]', text: 'text-[#2D6A6E]', accent: 'bg-[#4B9095]' },
];

function paletteFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % RESERVATION_PALETTE.length;
  return RESERVATION_PALETTE[idx]!;
}

// Conflict styling wins over palette — surfaces a clear visual alarm.
const CONFLICT_STYLE = {
  bar: 'bg-[#FDE3DA]',
  text: 'text-[#A03A10]',
  accent: 'bg-[var(--color-coral)]',
};

function styleFor(reservation) {
  if (reservation.hasConflict) return CONFLICT_STYLE;
  return paletteFor(reservation.id ?? reservation.bookingReference ?? reservation.guestName ?? '');
}

// Status badge inside the bar — kept short so it doesn't break the strip.
function statusGlyph(status: string) {
  if (status === 'CHECKED_IN') return '●';
  if (status === 'CHECKED_OUT') return '✓';
  return null;
}

// Compute which date columns a reservation covers within the visible window.
// Returns null when the stay is entirely outside the window.
function spanFor(reservation, dates: string[]) {
  if (!dates.length) return null;
  const ci = reservation.checkIn.slice(0, 10);
  const co = reservation.checkOut.slice(0, 10);
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  if (co <= first || ci > last) return null;
  // dates are ISO date keys; binary search would be overkill for ~30 cells.
  let start = dates.findIndex((d) => d >= ci);
  if (start === -1) start = 0;
  let end = -1;
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    if (dates[i]! < co) { end = i; break; }
  }
  if (end === -1) return null;
  if (end < start) return null;
  const startClipped = ci < first;
  const endClipped = co > addDays(new Date(`${last}T00:00:00+05:30`), 1).toISOString().slice(0, 10);
  return { start, end, startClipped, endClipped };
}

export function CalendarGrid({ rooms, from, to }: { rooms: any[]; from: string; to: string }) {
  const [selected, setSelected] = useState<any | null>(null);
  const dates = useMemo(() => buildDates(from, to), [from, to]);
  const sortedRooms = useMemo(() => [...(rooms ?? [])].sort(compareRooms), [rooms]);
  const today = todayKey();

  // Grid is laid out as (rooms.length + 1) rows × (dates.length + 1) cols.
  // Background cells render in their own grid cell; reservation bars sit on
  // top of the day cells via `grid-column: start / end+1` in the same row.
  return (
    <>
      <div className="overflow-x-auto rounded-[12px] bg-white shadow-[0_1px_3px_rgba(26,43,46,0.05)]">
        <div
          className="grid min-w-[1100px]"
          style={{
            gridTemplateColumns: `140px repeat(${dates.length}, minmax(56px, 1fr))`,
            gridAutoRows: '52px',
          }}
        >
          {/* Header — row 1 */}
          <div
            className="sticky left-0 z-20 flex items-center border-b border-r border-[#edf3f1] bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-mid-gray)]"
            style={{ gridColumn: '1', gridRow: '1' }}
          >
            Room
          </div>
          {dates.map((date, dIdx) => {
            const meta = dateMeta(date);
            const isToday = date === today;
            return (
              <div
                key={`hd-${date}`}
                className={`flex flex-col items-center justify-center gap-0.5 border-b border-l border-[#edf3f1] px-1 py-2 ${
                  isToday ? 'bg-[#E8F4F1]' : ''
                }`}
                style={{ gridColumn: `${dIdx + 2}`, gridRow: '1' }}
              >
                <span className={`text-[14px] font-semibold uppercase tracking-[0.06em] ${isToday ? 'text-[#0A6B58]' : 'text-[var(--color-mid-gray)]'}`}>
                  {meta.letter}
                </span>
                <span className={`text-[11px] font-semibold ${isToday ? 'text-[#0A6B58]' : 'text-[var(--color-charcoal)]'}`}>
                  {meta.day}
                </span>
              </div>
            );
          })}

          {/* Body — rows 2..N */}
          {sortedRooms.map((room, rIdx) => {
            const rowNum = rIdx + 2;
            return (
              <div key={room.roomId} className="contents">
                {/* Room label */}
                <div
                  className="sticky left-0 z-10 flex flex-col justify-center border-b border-r border-[#edf3f1] bg-white px-3"
                  style={{ gridColumn: '1', gridRow: `${rowNum}` }}
                >
                  <p className="text-[14px] font-semibold text-[var(--color-charcoal)]">{room.roomNumber}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-mid-gray)]">{room.roomType}</p>
                </div>

                {/* Background date cells — purely for gridlines and the today highlight */}
                {dates.map((date, dIdx) => {
                  const isToday = date === today;
                  return (
                    <div
                      key={`bg-${room.roomId}-${date}`}
                      className={`border-b border-l border-[#edf3f1] ${isToday ? 'bg-[#F2FAF6]' : ''}`}
                      style={{ gridColumn: `${dIdx + 2}`, gridRow: `${rowNum}` }}
                    />
                  );
                })}

                {/* Reservation bars — one button per stay, spans across columns.
                    Internally we draw N rounded pill backgrounds (one per night
                    with a small gap between them) and overlay the guest name on
                    top so it can extend across the booking. */}
                {(room.reservations ?? []).map((reservation) => {
                  const span = spanFor(reservation, dates);
                  if (!span) return null;
                  const style = styleFor(reservation);
                  const glyph = statusGlyph(reservation.status);
                  const nights = span.end - span.start + 1;
                  return (
                    <button
                      key={`res-${reservation.id ?? reservation.bookingReference ?? Math.random()}`}
                      type="button"
                      onClick={() =>
                        setSelected({
                          ...reservation,
                          status: deriveStatus(reservation),
                        })
                      }
                      className={`group relative z-10 mx-0.5 self-center flex h-6 min-h-0 items-center overflow-hidden whitespace-nowrap text-left text-xs font-semibold leading-none ${style.text}`}
                      style={{
                        gridColumn: `${span.start + 2} / ${span.end + 3}`,
                        gridRow: `${rowNum}`,
                      }}
                      title={`${reservation.guestName} · ${reservation.bookingReference ?? ''}`}
                    >
                      {/* Per-night pill backgrounds — separate rounded pills with a
                          small gap so the night count reads at a glance. */}
                      <span className="pointer-events-none absolute inset-0 flex gap-[6px]" aria-hidden="true">
                        {Array.from({ length: nights }).map((_, idx) => (
                          <span
                            key={`pill-${idx}`}
                            className={`relative flex-1 rounded-[6px] ${style.bar}`}
                          >
                            {idx === 0 && !span.startClipped ? (
                              <span className={`absolute inset-y-0 left-0 w-[3px] rounded-l-[6px] ${style.accent}`} />
                            ) : null}
                          </span>
                        ))}
                      </span>

                      {/* Foreground label — sits on top of the first pill and is
                          allowed to extend across the rest of the booking. */}
                      <span className="relative z-10 flex items-center gap-1 pl-2 pr-1">
                        {reservation.hasConflict ? <span className="font-bold">!</span> : null}
                        {glyph ? <span className="opacity-70">{glyph}</span> : null}
                        <span>{reservation.guestName}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <ReservationSlideOver reservation={selected} onClose={() => setSelected(null)} />
    </>
  );
}
