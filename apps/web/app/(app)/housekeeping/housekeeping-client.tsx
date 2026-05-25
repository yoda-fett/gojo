// @ts-nocheck
'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ComposedStatus } from '@/components/housekeeping/composed-status';
import { AssignStaffDrawer } from '@/components/housekeeping/assign-staff-drawer';
import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';

// Epic 15 + hotfix-7 Phase B: rows carry composed status, today's assignee, and
// derived flags so the dashboard can render wireframe 15a's KPI strip + 5
// filter tabs + per-card progress/priority/assignee strip without round-trips.
interface Assignee {
  name: string;
  initials: string;
}

export interface HousekeepingRow {
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  display: string;
  housekeeping: 'CLEAN' | 'DIRTY';
  occupancy: 'OCCUPIED' | 'VACANT';
  outOfService: { type: string; reason: string; from: string; to: string | null } | null;
  blockId: string | null;
  assignment: { id: string; staffUserId: string; stateVersion: number; name: string; initials: string } | null;
  assignee: Assignee | null;
  stateVersion: number;
  priority: 'high' | 'med' | 'low';
  reason: string;
  lastUpdatedAt: string;
}

export interface StaffOption {
  id: string;
  name: string;
  initials: string;
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
  staff: StaffOption[];
}

// hotfix-7 §6.4: "In Progress" = DIRTY + has today's RoomAssignment + not OOR.
// Richer per-task model (started_at, completion %) is parked under the Epic 15
// extension — see [[per-task-state-parked]].
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'to-clean', label: 'To Clean' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'clean', label: 'Clean' },
  { key: 'oor', label: 'Out of Order' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function isInProgress(row: HousekeepingRow) {
  return row.housekeeping === 'DIRTY' && !row.outOfService && !!row.assignee;
}

function passesFilter(row: HousekeepingRow, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'to-clean') return row.housekeeping === 'DIRTY' && !row.outOfService && !row.assignee;
  if (filter === 'in-progress') return isInProgress(row);
  if (filter === 'clean') return row.housekeeping === 'CLEAN' && !row.outOfService;
  if (filter === 'oor') return !!row.outOfService;
  return true;
}

export function HousekeepingClient() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<HousekeepingRow | null>(null);

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
        const body = await res.json().catch(() => ({}));
        alert(body.message ?? 'Update failed');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
    } finally {
      setBusy(null);
    }
  }

  async function liftBlock(row: HousekeepingRow) {
    if (!row.blockId) return;
    if (!confirm(`Mark room ${row.roomNumber} as fixed?`)) return;
    setBusy(row.roomId);
    try {
      const res = await fetch(`/api/rooms/${row.roomId}/blocks/${row.blockId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.message ?? 'Could not lift block');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
    } finally {
      setBusy(null);
    }
  }

  const rows = (data?.rooms ?? []).filter((r) => passesFilter(r, filter));
  const counts = data?.counts ?? { total: 0, needsCleaning: 0, inProgress: 0, cleanReady: 0, outOfOrder: 0 };
  const staff = data?.staff ?? [];

  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <PageShell header={<PageHeader variant="list" title="Housekeeping" subtitle={dateStr} />}>
      <section className="grid grid-cols-5 gap-3">
        <KpiCard label="Total Rooms" value={counts.total} sub="Property" />
        <KpiCard label="Needs Cleaning" value={counts.needsCleaning} sub="Dirty — unassigned" tone="amber" />
        <KpiCard label="In Progress" value={counts.inProgress} sub="Assigned & underway" tone="teal" />
        <KpiCard label="Clean" value={counts.cleanReady} sub="Housekeeping axis" tone="teal" />
        <KpiCard label="Out of Order" value={counts.outOfOrder} sub="Active block" tone="coral" />
      </section>

      <div className="mt-5 flex items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`border-r border-slate-200 px-4 py-2 text-sm font-medium last:border-r-0 ${
                filter === f.key ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f.label}{' '}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                  filter === f.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {countFor(f.key, counts)}
              </span>
            </button>
          ))}
        </div>
        <Button className="ml-auto inline-flex" href="/housekeeping/assignments" variant="primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
           Assign Staff
        </Button>
      </div>

      <section className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => {
          const inProgress = isInProgress(row);
          const variant = row.outOfService
            ? 'oor'
            : row.housekeeping === 'CLEAN'
              ? 'clean'
              : inProgress
                ? 'in-progress'
                : 'dirty';

          const cardBorder = {
            oor: 'border-[#D62B2B] opacity-80',
            'in-progress': 'border-[#1DA888]',
            dirty: 'border-[#E9C46A]',
            clean: 'border-slate-200',
          }[variant];

          // §6.5 — binary 0 / 50 / 100 approximation until per-task state ships.
          const progressPct = row.outOfService ? 0 : row.housekeeping === 'CLEAN' ? 100 : inProgress ? 50 : 0;
          const progressColor = row.outOfService ? '#D62B2B' : '#1DA888';

          return (
            <article key={row.roomId} className={`overflow-hidden rounded-xl border-[1.5px] bg-white ${cardBorder}`}>
              <div className="h-[3px] bg-[#F4F9F8]">
                <div className="h-[3px]" style={{ width: `${progressPct}%`, background: progressColor }} />
              </div>
              <div className="px-4 pb-3 pt-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xl font-bold text-slate-900">{row.roomNumber}</div>
                    <div className="text-xs text-slate-500">{row.roomTypeName}</div>
                  </div>
                </div>
                <div className="mt-2.5">
                  <ComposedStatus
                    display={row.display}
                    housekeeping={row.housekeeping}
                    outOfService={!!row.outOfService}
                  />
                </div>
                <PriorityRow priority={row.priority} outOfService={!!row.outOfService} />
                {row.reason ? <p className="mt-2 text-xs text-slate-600">{row.reason}</p> : null}
                {row.outOfService?.to ? (
                  <p className="mt-1 text-[11px] text-red-600">
                    Estimated resolve:{' '}
                    {new Date(row.outOfService.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </p>
                ) : null}
              </div>
              <CardFooter
                row={row}
                inProgress={inProgress}
                busy={busy === row.roomId}
                onTransition={transition}
                onAssign={(target) => setAssignTarget(target)}
                onMarkFixed={liftBlock}
              />
            </article>
          );
        })}
        {rows.length === 0 ? (
          <p className="col-span-full rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No rooms match this filter.
          </p>
        ) : null}
      </section>

      <AssignStaffDrawer
        row={assignTarget}
        staff={staff}
        onClose={() => setAssignTarget(null)}
        onSaved={async () => {
          setAssignTarget(null);
          await queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
        }}
      />
    </PageShell>
  );
}

function countFor(key: FilterKey, counts: HousekeepingResponse['counts']) {
  if (key === 'all') return counts.total;
  if (key === 'to-clean') return counts.needsCleaning;
  if (key === 'in-progress') return counts.inProgress;
  if (key === 'clean') return counts.cleanReady;
  if (key === 'oor') return counts.outOfOrder;
  return 0;
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
    tone === 'teal'
      ? 'text-teal-700'
      : tone === 'amber'
        ? 'text-amber-600'
        : tone === 'coral'
          ? 'text-orange-600'
          : 'text-slate-900';
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function PriorityRow({ priority, outOfService }: { priority: 'high' | 'med' | 'low'; outOfService: boolean }) {
  if (outOfService) {
    return (
      <div className="mt-2 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-[11px] font-semibold text-red-600">Maintenance</span>
      </div>
    );
  }
  const colors = {
    high: { dot: 'bg-orange-500', label: 'text-orange-600' },
    med: { dot: 'bg-amber-400', label: 'text-amber-600' },
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

function CardFooter({
  row,
  inProgress: _inProgress,
  busy,
  onTransition,
  onAssign,
  onMarkFixed,
}: {
  row: HousekeepingRow;
  inProgress: boolean;
  busy: boolean;
  onTransition: (row: HousekeepingRow, toState: string) => void;
  onAssign: (row: HousekeepingRow) => void;
  onMarkFixed: (row: HousekeepingRow) => void;
}) {
  if (row.outOfService) {
    return (
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">
            MN
          </span>
          <span className="text-xs font-medium text-slate-700">Maintenance</span>
        </div>
        <button
          type="button"
          disabled={busy || !row.blockId}
          onClick={() => onMarkFixed(row)}
          className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:text-slate-400"
        >
          Mark Fixed →
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
      <div className="flex items-center gap-2">
        {row.assignee ? (
          <>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1A2B2E] text-[10px] font-bold text-[#1DA888]">
              {row.assignee.initials}
            </span>
            <span className="text-xs font-medium text-slate-700">{row.assignee.name}</span>
          </>
        ) : (
          <span className="text-xs italic text-slate-400">Unassigned</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {row.housekeeping === 'DIRTY' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onTransition(row, 'CLEAN')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:text-slate-400"
          >
            Mark Clean
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onTransition(row, 'DIRTY')}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 disabled:text-slate-300"
          >
            Mark Dirty
          </button>
        )}
        <button
          type="button"
          onClick={() => onAssign(row)}
          className="text-xs font-semibold text-[#1DA888] hover:text-teal-700"
        >
          {row.assignee ? 'Reassign' : 'Assign →'}
        </button>
      </div>
    </div>
  );
}
