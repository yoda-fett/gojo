// @ts-nocheck
'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface HousekeepingRow {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  state: string;
  stateVersion: number;
  priority: 'high' | 'med' | 'low';
  reason: string;
  blockId: string | null;
  blockType: string | null;
  blockEndDate: string | null;
  lastUpdatedAt: string;
}

interface HousekeepingResponse {
  rooms: HousekeepingRow[];
  counts: {
    total: number;
    needsCleaning: number;
    inProgress: number;
    cleanReady: number;
    outOfOrder: number;
  };
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'to-clean', label: 'To Clean' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'clean', label: 'Clean' },
  { key: 'oor', label: 'Out of Order' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const STATE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  DIRTY: { label: '✦ Dirty', bg: 'bg-amber-100', text: 'text-amber-800' },
  CLEAN: { label: '✓ Clean', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  AVAILABLE: { label: '◯ Available', bg: 'bg-slate-100', text: 'text-slate-700' },
  OCCUPIED: { label: '● In House', bg: 'bg-teal-100', text: 'text-teal-800' },
  HELD: { label: '◆ Held', bg: 'bg-slate-100', text: 'text-slate-700' },
  OUT_OF_ORDER: { label: '✕ Out of Order', bg: 'bg-red-100', text: 'text-red-700' },
  MAINTENANCE: { label: '⚒ Maintenance', bg: 'bg-amber-100', text: 'text-amber-800' },
};

function passesFilter(row: HousekeepingRow, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'to-clean') return row.state === 'DIRTY';
  if (filter === 'in-progress') return false;
  if (filter === 'clean') return row.state === 'CLEAN' || row.state === 'AVAILABLE';
  if (filter === 'oor') return row.state === 'OUT_OF_ORDER' || row.state === 'MAINTENANCE';
  return true;
}

export function HousekeepingClient() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['housekeeping'],
    queryFn: async () => {
      const res = await fetch('/api/housekeeping');
      if (!res.ok) throw new Error('Failed to load');
      return (await res.json()) as HousekeepingResponse;
    },
    refetchInterval: 30_000,
  });

  async function transition(row: HousekeepingRow, toState: string) {
    setBusy(row.roomId);
    try {
      const res = await fetch(`/api/rooms/${row.roomId}/housekeeping-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState, stateVersion: row.stateVersion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message ?? 'Update failed');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
    } finally {
      setBusy(null);
    }
  }

  function actionLabel(row: HousekeepingRow): { label: string; toState: string } | null {
    if (row.state === 'DIRTY') return { label: 'Mark Clean', toState: 'CLEAN' };
    if (row.state === 'CLEAN') return { label: 'Mark Available', toState: 'AVAILABLE' };
    if (row.state === 'AVAILABLE') return { label: 'Mark Dirty', toState: 'DIRTY' };
    return null;
  }

  const rows = (data?.rooms ?? []).filter((r) => passesFilter(r, filter));
  const counts = data?.counts ?? { total: 0, needsCleaning: 0, inProgress: 0, cleanReady: 0, outOfOrder: 0 };

  return (
    <main className="bg-slate-50 px-8 py-7">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Housekeeping</h1>
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </header>

      <section className="grid grid-cols-5 gap-3">
        <KpiCard label="Total Rooms" value={counts.total} sub="Property" />
        <KpiCard label="Needs Cleaning" value={counts.needsCleaning} sub="Priority queue" tone="amber" />
        <KpiCard label="In Progress" value={counts.inProgress} sub="Assigned" tone="teal" />
        <KpiCard label="Clean & Ready" value={counts.cleanReady} sub="Available" tone="teal" />
        <KpiCard label="Out of Order" value={counts.outOfOrder} sub="Maintenance" tone="coral" />
      </section>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`border-r border-slate-200 px-4 py-2 text-sm font-medium last:border-r-0 ${filter === f.key ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {f.label}{' '}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[8px] ${filter === f.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {countFor(f.key, counts, data?.rooms ?? [])}
              </span>
            </button>
          ))}
        </div>
      </div>

      <section className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => {
          const badge = STATE_BADGE[row.state] ?? { label: row.state, bg: 'bg-slate-100', text: 'text-slate-700' };
          const action = actionLabel(row);
          const cardBorder =
            row.state === 'DIRTY'
              ? 'border-amber-300'
              : row.state === 'OUT_OF_ORDER'
                ? 'border-red-300'
                : row.state === 'CLEAN'
                  ? 'border-slate-200'
                  : 'border-slate-200';

          return (
            <article key={row.roomId} className={`overflow-hidden rounded-xl border-[1.5px] bg-white ${cardBorder}`}>
              <div className="px-4 pb-3 pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xl font-bold text-slate-900">{row.roomNumber}</div>
                    <div className="text-xs text-slate-500">{row.roomTypeName}</div>
                  </div>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
                <PriorityRow priority={row.priority} state={row.state} />
                {row.reason ? <p className="mt-2 text-xs text-slate-600">{row.reason}</p> : null}
                {row.blockEndDate ? (
                  <p className="mt-1 text-[11px] text-red-600">
                    Estimated resolve: {new Date(row.blockEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
                <span className="text-xs text-slate-500">v{row.stateVersion}</span>
                {action ? (
                  <button
                    type="button"
                    disabled={busy === row.roomId}
                    onClick={() => transition(row, action.toState)}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800 disabled:text-slate-400"
                  >
                    {action.label} →
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
        {rows.length === 0 ? (
          <p className="col-span-full rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No rooms match this filter.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function countFor(key: FilterKey, counts: HousekeepingResponse['counts'], rows: HousekeepingRow[]) {
  if (key === 'all') return counts.total;
  if (key === 'to-clean') return counts.needsCleaning;
  if (key === 'in-progress') return counts.inProgress;
  if (key === 'clean') return counts.cleanReady;
  if (key === 'oor') return counts.outOfOrder;
  return rows.length;
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'teal' | 'amber' | 'coral';
}) {
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

function PriorityRow({ priority, state }: { priority: 'high' | 'med' | 'low'; state: string }) {
  if (state === 'OUT_OF_ORDER' || state === 'MAINTENANCE') {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-[11px] font-semibold text-red-600">Maintenance</span>
      </div>
    );
  }
  const colors = {
    high: { dot: 'bg-red-500', label: 'text-red-600' },
    med: { dot: 'bg-amber-500', label: 'text-amber-700' },
    low: { dot: 'bg-slate-300', label: 'text-slate-500' },
  } as const;
  const labelMap = { high: 'High priority', med: 'Medium priority', low: 'No action needed' } as const;
  const c = colors[priority];
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      <span className={`text-[11px] font-semibold ${c.label}`}>{labelMap[priority]}</span>
    </div>
  );
}
