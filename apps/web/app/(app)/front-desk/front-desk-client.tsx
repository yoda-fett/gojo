'use client';
// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Fragment, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';

interface Summary {
  totalRooms: number;
  inHouse: number;
  arrivingToday: number;
  departingToday: number;
  needsCleaning: number;
}

interface RoomGridResponse {
  groups: Array<{
    roomTypeId: string;
    roomTypeName: string;
    rooms: Array<{
      roomId: string;
      roomNumber: string;
      state: string;
      stateVersion: number;
      guestName: string | null;
      reservationId: string | null;
      bookingReference: string | null;
      checkIn: string | null;
      checkOut: string | null;
      nightNumber: number | null;
      totalNights: number | null;
      visualState: string;
      lastGuestName: string | null;
      lastCheckOut: string | null;
      nextArrivalGuestName: string | null;
      nextArrivalCheckIn: string | null;
      nextArrivalBookingReference: string | null;
    }>;
  }>;
}

interface ListResponse {
  items: Array<{
    reservationId: string;
    bookingReference: string | null;
    guestName: string;
    roomNumber?: string;
    roomTypeName?: string;
    nights?: number;
    checkIn?: string;
    checkOut?: string;
    status: string;
  }>;
}

const FALLBACK_DOT = { dot: 'bg-slate-300', label: 'Vacant Clean' };
function visualDot(key: string) {
  return VISUAL_DOT[key] ?? FALLBACK_DOT;
}
const VISUAL_DOT: Record<string, { dot: string; label: string }> = {
  arriving: { dot: 'bg-orange-500', label: 'Arriving' },
  in_house: { dot: 'bg-teal-500', label: 'In-House' },
  departing: { dot: 'bg-amber-500', label: 'Departing' },
  vacant_clean: { dot: 'bg-slate-300', label: 'Vacant Clean' },
  dirty: { dot: 'bg-amber-300', label: 'Needs Cleaning' },
  out_of_order: { dot: 'bg-red-600', label: 'Out of Order' },
  maintenance: { dot: 'bg-amber-600', label: 'Maintenance' },
  held: { dot: 'bg-slate-400', label: 'On Hold' },
};

export function FrontDeskClient() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [groupBy, setGroupBy] = useState<'none' | 'floor' | 'roomType'>('none');

  const summary = useQuery({
    queryKey: ['front-desk-summary'],
    queryFn: async () => {
      const res = await fetch('/api/front-desk/summary');
      if (!res.ok) throw new Error('Failed');
      return (await res.json()) as Summary;
    },
    refetchInterval: 30_000,
  });

  const grid = useQuery({
    queryKey: ['front-desk-grid'],
    queryFn: async () => {
      const res = await fetch('/api/front-desk/room-grid');
      if (!res.ok) throw new Error('Failed');
      return (await res.json()) as RoomGridResponse;
    },
    refetchInterval: 30_000,
  });

  const arrivals = useQuery({
    queryKey: ['front-desk-arrivals'],
    queryFn: async () => {
      const res = await fetch('/api/front-desk/arrivals');
      if (!res.ok) throw new Error('Failed');
      return (await res.json()) as ListResponse;
    },
    refetchInterval: 30_000,
  });

  const departures = useQuery({
    queryKey: ['front-desk-departures'],
    queryFn: async () => {
      const res = await fetch('/api/front-desk/departures');
      if (!res.ok) throw new Error('Failed');
      return (await res.json()) as ListResponse;
    },
    refetchInterval: 30_000,
  });

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <PageShell
      header={
        <PageHeader
          variant="list"
          title="Front Desk"
          subtitle={dateStr}
          primary={
            <Button href="/reservations/new" variant="primary">
              + Walk-in
            </Button>
          }
        />
      }
    >
      <section className="grid grid-cols-5 gap-3">
        <Kpi label="Total Rooms" value={summary.data?.totalRooms ?? 0} sub="Property" />
        <Kpi label="In-House" value={summary.data?.inHouse ?? 0} sub="Currently staying" tone="teal" />
        <Kpi label="Arriving Today" value={summary.data?.arrivingToday ?? 0} sub="Confirmed" tone="coral" />
        <Kpi label="Departing Today" value={summary.data?.departingToday ?? 0} sub="Checking out" tone="amber" />
        <Kpi label="Needs Cleaning" value={summary.data?.needsCleaning ?? 0} sub="To clean" tone="amber" />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--color-line-soft)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--color-charcoal)]">Room Grid</h2>
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-[var(--color-line-soft)] text-xs">
                {(['none', 'floor', 'roomType'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setGroupBy(opt)}
                    className={`px-3 py-1.5 ${groupBy === opt ? 'bg-[var(--color-teal)] text-white' : 'text-[var(--color-mid-gray)]'}`}
                  >
                    {opt === 'none' ? 'None' : opt === 'floor' ? 'Floor' : 'Room-type'}
                  </button>
                ))}
              </div>
              <div className="flex overflow-hidden rounded-lg border border-[var(--color-line-soft)] text-xs">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  className={`px-3 py-1.5 ${view === 'grid' ? 'bg-[var(--color-teal)] text-white' : 'text-[var(--color-mid-gray)]'}`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={`px-3 py-1.5 ${view === 'list' ? 'bg-[var(--color-teal)] text-white' : 'text-[var(--color-mid-gray)]'}`}
                >
                  List
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-4 px-5 py-4">
            {view === 'grid' ? (
              <RoomGridView groups={grid.data?.groups ?? []} groupBy={groupBy} />
            ) : (
              <RoomListView groups={grid.data?.groups ?? []} groupBy={groupBy} />
            )}
            <Legend />
          </div>
        </div>

        <div className="space-y-5">
          <SidePanel title="Arriving Today" empty="No arrivals today" rows={arrivals.data?.items ?? []} variant="arriving" />
          <SidePanel title="Departing Today" empty="No departures today" rows={departures.data?.items ?? []} variant="departing" />
        </div>
      </section>
    </PageShell>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: 'teal' | 'amber' | 'coral' }) {
  const color =
    tone === 'teal' ? 'text-teal-700' : tone === 'amber' ? 'text-amber-600' : tone === 'coral' ? 'text-orange-600' : 'text-slate-900';
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

// Per-state card styling. Tile colors match the wireframe-grade legend on
// /dashboard so a room's "feel" is consistent across screens.
type RoomTileStyle = {
  card: string;
  number: string;
  roomType: string;
  pill: string;
  pillIcon: string;
  pillLabel: string;
  primary: string;
  primaryMuted?: boolean;
  cornerTone: string;
};

const ROOM_TILE_STYLES: Record<string, RoomTileStyle> = {
  in_house: {
    card: 'border-[#9CCFBE] bg-[#F2FAF7]',
    number: 'text-[var(--color-charcoal)]',
    roomType: 'text-[var(--color-mid-gray)]',
    pill: 'bg-[#D5EAE5] text-[#0A6B58]',
    pillIcon: '●',
    pillLabel: 'Checked In',
    primary: 'text-[var(--color-charcoal)]',
    cornerTone: 'text-[#0A6B58]',
  },
  departing: {
    card: 'border-[#F1B69B] bg-[#FDEEE6]',
    number: 'text-[var(--color-charcoal)]',
    roomType: 'text-[var(--color-mid-gray)]',
    pill: 'bg-[#F8C9B6] text-[#C45A20]',
    pillIcon: '↑',
    pillLabel: 'Departing Today',
    primary: 'text-[var(--color-charcoal)]',
    cornerTone: 'text-[var(--color-mid-gray)]',
  },
  arriving: {
    card: 'border-[#E5CF80] bg-[#FBF6DC]',
    number: 'text-[var(--color-charcoal)]',
    roomType: 'text-[var(--color-mid-gray)]',
    pill: 'bg-[#F1E1A6] text-[#8a6610]',
    pillIcon: '↓',
    pillLabel: 'Arriving Today',
    primary: 'text-[var(--color-charcoal)]',
    cornerTone: 'text-[var(--color-mid-gray)]',
  },
  dirty: {
    card: 'border-[#E5CF80] bg-[#FBF6DC]',
    number: 'text-[var(--color-mid-gray)]',
    roomType: 'text-[var(--color-mid-gray)]',
    pill: 'bg-[#F1E1A6] text-[#8a6610]',
    pillIcon: '✦',
    pillLabel: 'Needs Cleaning',
    primary: 'text-[var(--color-mid-gray)]',
    primaryMuted: true,
    cornerTone: 'text-[var(--color-mid-gray)]',
  },
  vacant_clean: {
    card: 'border-[#E8EFEE] bg-white',
    number: 'text-[var(--color-charcoal)]',
    roomType: 'text-[var(--color-mid-gray)]',
    pill: 'bg-[#EEF2F1] text-[var(--color-mid-gray)]',
    pillIcon: '○',
    pillLabel: 'Vacant Clean',
    primary: 'text-[var(--color-mid-gray)]',
    primaryMuted: true,
    cornerTone: 'text-[var(--color-mid-gray)]',
  },
  out_of_order: {
    card: 'border-[#F1B69B] bg-[#FDEEE6]',
    number: 'text-[var(--color-mid-gray)]',
    roomType: 'text-[var(--color-mid-gray)]',
    pill: 'bg-[#F8C9B6] text-[#A03A10]',
    pillIcon: '×',
    pillLabel: 'Out of Order',
    primary: 'text-[var(--color-mid-gray)]',
    primaryMuted: true,
    cornerTone: 'text-[var(--color-mid-gray)]',
  },
  maintenance: {
    card: 'border-[#F1B69B] bg-[#FDEEE6]',
    number: 'text-[var(--color-mid-gray)]',
    roomType: 'text-[var(--color-mid-gray)]',
    pill: 'bg-[#F8C9B6] text-[#A03A10]',
    pillIcon: '×',
    pillLabel: 'Maintenance',
    primary: 'text-[var(--color-mid-gray)]',
    primaryMuted: true,
    cornerTone: 'text-[var(--color-mid-gray)]',
  },
  held: {
    card: 'border-[#E8EFEE] bg-[var(--color-off-white)]',
    number: 'text-[var(--color-mid-gray)]',
    roomType: 'text-[var(--color-mid-gray)]',
    pill: 'bg-[#EEF2F1] text-[var(--color-mid-gray)]',
    pillIcon: '○',
    pillLabel: 'On Hold',
    primary: 'text-[var(--color-mid-gray)]',
    primaryMuted: true,
    cornerTone: 'text-[var(--color-mid-gray)]',
  },
};

function formatDayMonth(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

// Returns an ETA-style time label ("ETA 2:00 pm") if the reservation carries
// a meaningful clock time; null if the time looks like an unset default
// (midnight UTC, which most seed data uses).
function formatEta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  if (hours === 0 && minutes === 0) return null;
  const time = ist.toLocaleString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
  return `ETA ${time.toLowerCase()}`;
}

type GroupBy = 'none' | 'floor' | 'roomType';

function sortByRoomNumber<T extends { roomNumber: string }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => {
    const an = Number(a.roomNumber);
    const bn = Number(b.roomNumber);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
    return a.roomNumber.localeCompare(b.roomNumber);
  });
}

// Floor is conventionally the hundreds-digit of a room number ("101" → 1,
// "203" → 2). For shorter labels, fall back to the leading digit; non-numeric
// rooms collapse into an "Other" bucket so they still render.
function floorOf(roomNumber: string): { key: string; label: string } {
  const n = Number(roomNumber);
  if (!Number.isNaN(n) && n >= 100) {
    const f = Math.floor(n / 100);
    return { key: String(f), label: `Floor ${f}` };
  }
  if (!Number.isNaN(n)) {
    return { key: '0', label: 'Ground Floor' };
  }
  return { key: 'other', label: 'Other' };
}

function flattenRooms(groups: RoomGridResponse['groups']) {
  return groups.flatMap((g) => g.rooms.map((r) => ({ ...r, roomTypeName: g.roomTypeName })));
}

function groupByFloor<T extends { roomNumber: string }>(rooms: T[]): Array<{ key: string; label: string; rooms: T[] }> {
  const buckets = new Map<string, { label: string; rooms: T[] }>();
  for (const r of rooms) {
    const f = floorOf(r.roomNumber);
    const existing = buckets.get(f.key);
    if (existing) existing.rooms.push(r);
    else buckets.set(f.key, { label: f.label, rooms: [r] });
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      const an = Number(a);
      const bn = Number(b);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
      return a.localeCompare(b);
    })
    .map(([key, { label, rooms: rs }]) => ({ key, label, rooms: sortByRoomNumber(rs) }));
}

function RoomGridView({ groups, groupBy }: { groups: RoomGridResponse['groups']; groupBy: GroupBy }) {
  const flat = flattenRooms(groups);

  if (groupBy === 'none') {
    const sorted = sortByRoomNumber(flat);
    return (
      <div>
        {sorted.length === 0 ? (
          <p className="text-sm text-[var(--color-mid-gray)]">No rooms configured.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3">
            {sorted.map((r) => (
              <RoomTile key={r.roomId} room={r} roomTypeName={r.roomTypeName} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const sections =
    groupBy === 'floor'
      ? groupByFloor(flat).map((s) => ({ key: s.key, label: s.label, rooms: s.rooms }))
      : groups.map((g) => ({
          key: g.roomTypeId,
          label: g.roomTypeName,
          rooms: sortByRoomNumber(g.rooms).map((r) => ({ ...r, roomTypeName: g.roomTypeName })),
        }));

  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <section key={s.key}>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-mid-gray)]">{s.label}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {s.rooms.map((r) => (
              <RoomTile key={r.roomId} room={r} roomTypeName={r.roomTypeName} />
            ))}
          </div>
        </section>
      ))}
      {sections.length === 0 ? <p className="text-sm text-[var(--color-mid-gray)]">No rooms configured.</p> : null}
    </div>
  );
}

function RoomTile({
  room,
  roomTypeName,
}: {
  room: RoomGridResponse['groups'][number]['rooms'][number];
  roomTypeName: string;
}) {
  const style = ROOM_TILE_STYLES[room.visualState] ?? ROOM_TILE_STYLES.vacant_clean!;
  const href = room.reservationId ? `/reservations/${room.reservationId}` : '#';
  const isClickable = !!room.reservationId;

  // Top-right "Night X of Y" / "Departing" label varies by state.
  const cornerLabel = (() => {
    if (room.visualState === 'in_house' && room.nightNumber && room.totalNights) {
      return `Night ${room.nightNumber} of ${room.totalNights}`;
    }
    if (room.visualState === 'departing') return 'Departing';
    return null;
  })();

  // Bottom block — name + booking ref + date line. Varies by state.
  const bottomPrimary = (() => {
    if (room.guestName) return room.guestName;
    if (room.visualState === 'out_of_order' || room.visualState === 'maintenance') return 'Maintenance';
    if (room.visualState === 'dirty') return 'Vacant';
    if (room.visualState === 'vacant_clean') return 'Available';
    if (room.visualState === 'held') return 'On Hold';
    return '—';
  })();

  const bottomSecondary = (() => {
    if (room.bookingReference && room.checkOut && room.visualState === 'in_house') {
      return `Check-out ${formatDayMonth(room.checkOut)} · ${room.bookingReference}`;
    }
    if (room.bookingReference && room.visualState === 'departing') {
      return `Check-out today · ${room.bookingReference}`;
    }
    if (room.bookingReference && room.visualState === 'arriving') {
      const eta = formatEta(room.checkIn);
      return `${eta ?? 'Check-in Today'} · ${room.bookingReference}`;
    }
    // Dirty room with an active/incoming reservation — next guest arriving.
    // ETA from the reservation's check-in time when present, else generic
    // "Check-in Today" copy.
    if (room.bookingReference && room.visualState === 'dirty') {
      const eta = formatEta(room.checkIn);
      return `${eta ?? 'ETA not set'} · ${room.bookingReference}`;
    }
    // Dirty room with no incoming reservation — surface the last departed
    // guest so front-desk staff have context on who just left.
    if (room.visualState === 'dirty' && room.lastGuestName) {
      return `Last: ${room.lastCheckOut ? `${formatDayMonth(room.lastCheckOut)}` : ''} · ${room.lastGuestName}`;
    }
    // Clean room with a future arrival — show the next guest landing so
    // front-desk staff can pre-empt prep work.
    if (
      room.visualState === 'vacant_clean' &&
      room.nextArrivalCheckIn &&
      room.nextArrivalGuestName
    ) {
      return `Next Arrival: ${formatDayMonth(room.nextArrivalCheckIn)} · ${room.nextArrivalGuestName}`;
    }
    // Held / on-hold (transient booking lock).
    if (room.visualState === 'held') {
      return room.bookingReference ? `Awaiting confirmation · ${room.bookingReference}` : 'Awaiting confirmation';
    }
    // Out-of-order or under maintenance — show why if we ever have a reason.
    if (room.visualState === 'out_of_order' || room.visualState === 'maintenance') {
      return 'Not bookable';
    }
    return null;
  })();

  return (
    <Link
      href={href}
      className={`block rounded-[12px] border p-4 transition ${style.card} ${
        isClickable ? 'hover:shadow-[0_2px_6px_rgba(26,43,46,0.08)]' : 'cursor-default'
      }`}
      onClick={(e) => {
        if (!isClickable) e.preventDefault();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[24px] font-bold leading-tight ${style.number}`}>{room.roomNumber}</div>
          <div className={`mt-0.5 text-[12px] ${style.roomType}`}>{roomTypeName}</div>
        </div>
        {cornerLabel ? (
          <span className={`shrink-0 text-[11px] font-medium ${style.cornerTone}`}>{cornerLabel}</span>
        ) : null}
      </div>

      <span className={`mt-3 inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11.5px] font-semibold ${style.pill}`}>
        <span className="text-[12px] leading-none">{style.pillIcon}</span>
        {style.pillLabel}
      </span>

      <div className="mt-3">
        <div className={`truncate text-[13.5px] font-semibold ${style.primary}`}>{bottomPrimary}</div>
        {bottomSecondary ? (
          <div className="mt-0.5 truncate text-[11.5px] text-[var(--color-mid-gray)]">{bottomSecondary}</div>
        ) : null}
      </div>
    </Link>
  );
}

function RoomListView({ groups, groupBy }: { groups: RoomGridResponse['groups']; groupBy: GroupBy }) {
  const flat = flattenRooms(groups);

  const sections: Array<{ key: string; label: string | null; rooms: typeof flat }> = (() => {
    if (groupBy === 'none') return [{ key: 'all', label: null, rooms: sortByRoomNumber(flat) }];
    if (groupBy === 'floor') {
      return groupByFloor(flat).map((s) => ({ key: s.key, label: s.label, rooms: s.rooms }));
    }
    return groups.map((g) => ({
      key: g.roomTypeId,
      label: g.roomTypeName,
      rooms: sortByRoomNumber(g.rooms).map((r) => ({ ...r, roomTypeName: g.roomTypeName })),
    }));
  })();

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs uppercase text-slate-500">
        <tr>
          <th className="px-3 py-2">Room</th>
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">Guest</th>
        </tr>
      </thead>
      <tbody>
        {sections.map((s) => (
          <Fragment key={s.key}>
            {s.label ? (
              <tr className="bg-[var(--color-off-white)]">
                <td colSpan={4} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-mid-gray)]">
                  {s.label}
                </td>
              </tr>
            ) : null}
            {s.rooms.map((r) => {
              const v = visualDot(r.visualState);
              return (
                <tr key={r.roomId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{r.roomNumber}</td>
                  <td className="px-3 py-2 text-slate-600">{r.roomTypeName}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${v.dot}`} />
                      <span className="text-xs">{v.label}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.guestName ?? '—'}</td>
                </tr>
              );
            })}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function Legend() {
  const items = ['arriving', 'in_house', 'departing', 'vacant_clean', 'dirty', 'out_of_order'];
  return (
    <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
      {items.map((k) => {
        const v = visualDot(k);
        return (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${v.dot}`} />
            {v.label}
          </span>
        );
      })}
    </div>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '·'
  );
}

function SidePanel({
  title,
  rows,
  empty,
  variant,
}: {
  title: string;
  rows: ListResponse['items'];
  empty: string;
  variant: 'arriving' | 'departing';
}) {
  const pendingCount = rows.filter((r) =>
    variant === 'arriving' ? r.status !== 'CHECKED_IN' : r.status !== 'CHECKED_OUT',
  ).length;

  return (
    <div className="rounded-[12px] bg-white shadow-[0_1px_3px_rgba(26,43,46,0.05)]">
      <div className="flex items-center justify-between border-b border-[var(--color-line-soft)] px-5 py-3.5">
        <h2 className="text-[14px] font-semibold text-[var(--color-charcoal)]">{title}</h2>
        {rows.length > 0 ? (
          <span className="text-[12px] text-[var(--color-mid-gray)]">
            {rows.length} total · {pendingCount} pending
          </span>
        ) : null}
      </div>
      <div className="divide-y divide-[#F0F5F4]">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-8 text-center">
            <div className="mb-2 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#EAF4FA] text-2xl">
              {variant === 'arriving' ? '🛬' : '🛫'}
            </div>
            <p className="text-[14px] font-semibold text-[var(--color-charcoal)]">{empty}</p>
            <p className="mt-1 text-[12.5px] text-[var(--color-mid-gray)]">
              {variant === 'arriving' ? 'Walk-in reservations will appear here' : 'All checked out — well done'}
            </p>
          </div>
        ) : (
          rows.map((r) => {
            const pending = variant === 'arriving' ? r.status !== 'CHECKED_IN' : r.status !== 'CHECKED_OUT';
            const chip = pending
              ? variant === 'arriving'
                ? 'bg-[#F1E1A6] text-[#8a6610]'
                : 'bg-[#F8C9B6] text-[#C45A20]'
              : variant === 'arriving'
                ? 'bg-[#D5EAE5] text-[#0A6B58]'
                : 'bg-[#D5EAE5] text-[#0A6B58]';
            const chipLabel = pending
              ? variant === 'arriving'
                ? 'Confirmed'
                : 'Due Out'
              : variant === 'arriving'
                ? 'Checked In'
                : 'Checked Out';
            const nightsLabel = r.nights ? `${r.nights} night${r.nights === 1 ? '' : 's'}` : null;
            return (
              <Link
                key={r.reservationId}
                href={`/reservations/${r.reservationId}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--color-off-white)]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6F2] text-[12px] font-bold tracking-[0.04em] text-[#0A6B58]">
                  {initials(r.guestName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[var(--color-charcoal)]">{r.guestName}</p>
                  <p className="truncate text-[12px] text-[var(--color-mid-gray)]">
                    {r.bookingReference ?? r.reservationId.slice(-6).toUpperCase()}
                    {nightsLabel ? ` · ${nightsLabel}` : ''}
                    {r.roomNumber ? ` · ${r.roomNumber}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {/*
                  {r.roomNumber ? (
                    <span className="text-[14px] font-bold text-[var(--color-charcoal)]">Rm {r.roomNumber}</span>
                  ) : null}
                  */}
                  <span className={`rounded-[6px] px-2 py-0.5 text-[11.5px] font-semibold ${chip}`}>{chipLabel}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
