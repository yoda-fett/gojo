'use client';
// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

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
      visualState: string;
    }>;
  }>;
}

interface ListResponse {
  items: Array<{
    reservationId: string;
    bookingReference: string | null;
    guestName: string;
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
    <main className="bg-slate-50 px-8 py-7">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Front Desk</h1>
          <p className="text-xs text-slate-500">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reservations/new"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
          >
            + Walk-in
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-5 gap-3">
        <Kpi label="Total Rooms" value={summary.data?.totalRooms ?? 0} sub="Property" />
        <Kpi label="In-House" value={summary.data?.inHouse ?? 0} sub="Currently staying" tone="teal" />
        <Kpi label="Arriving Today" value={summary.data?.arrivingToday ?? 0} sub="Confirmed" tone="coral" />
        <Kpi label="Departing Today" value={summary.data?.departingToday ?? 0} sub="Checking out" tone="amber" />
        <Kpi label="Needs Cleaning" value={summary.data?.needsCleaning ?? 0} sub="To clean" tone="amber" />
      </section>

      <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Room Grid</h2>
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`px-3 py-1.5 ${view === 'grid' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className={`px-3 py-1.5 ${view === 'list' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}
              >
                List
              </button>
            </div>
          </div>
          <div className="space-y-4 px-5 py-4">
            {view === 'grid' ? (
              <RoomGridView groups={grid.data?.groups ?? []} />
            ) : (
              <RoomListView groups={grid.data?.groups ?? []} />
            )}
            <Legend />
          </div>
        </div>

        <div className="space-y-5">
          <SidePanel title="Arriving Today" empty="No arrivals today" rows={arrivals.data?.items ?? []} variant="arriving" />
          <SidePanel title="Departing Today" empty="No departures today" rows={departures.data?.items ?? []} variant="departing" />
        </div>
      </section>
    </main>
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

function RoomGridView({ groups }: { groups: RoomGridResponse['groups'] }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.roomTypeId}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{g.roomTypeName}</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {g.rooms.map((r) => {
              const v = visualDot(r.visualState);
              return (
                <Link
                  key={r.roomId}
                  href={r.reservationId ? `/reservations/${r.reservationId}` : '#'}
                  className="rounded-lg border border-slate-200 bg-white p-3 transition hover:border-teal-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-slate-900">{r.roomNumber}</span>
                    <span className={`h-2 w-2 rounded-full ${v.dot}`} title={v.label} />
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">{r.guestName ?? v.label}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      {groups.length === 0 ? <p className="text-sm text-slate-500">No rooms configured.</p> : null}
    </div>
  );
}

function RoomListView({ groups }: { groups: RoomGridResponse['groups'] }) {
  const flat = groups.flatMap((g) => g.rooms.map((r) => ({ ...r, roomTypeName: g.roomTypeName })));
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
        {flat.map((r) => {
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
  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-8 text-center">
            <div className="mb-2 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-teal-50 text-2xl">
              {variant === 'arriving' ? '🛬' : '🛫'}
            </div>
            <p className="text-sm font-medium text-slate-700">{empty}</p>
            <p className="mt-1 text-xs text-slate-500">
              {variant === 'arriving' ? 'Walk-in reservations will appear here' : 'All checked out — well done'}
            </p>
          </div>
        ) : (
          rows.map((r) => {
            const time = (r.checkIn ?? r.checkOut ?? '').toString();
            const pending = (variant === 'arriving' && r.status === 'CONFIRMED') || (variant === 'departing' && r.status === 'CHECKED_IN');
            const chip = pending
              ? variant === 'arriving'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-amber-100 text-amber-800'
              : variant === 'arriving'
                ? 'bg-teal-100 text-teal-800'
                : 'bg-slate-100 text-slate-600';
            const chipLabel = pending
              ? 'Pending'
              : variant === 'arriving'
                ? 'Checked In'
                : 'Checked Out';
            return (
              <Link
                key={r.reservationId}
                href={`/reservations/${r.reservationId}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
                  {r.guestName.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{r.guestName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {time ? new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''} ·{' '}
                    {r.bookingReference ?? r.reservationId.slice(-6).toUpperCase()}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip}`}>{chipLabel}</span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
