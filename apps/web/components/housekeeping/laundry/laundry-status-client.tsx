'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, PackageOpen, Send, Shirt, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

// Hotfix-8 Phase B — wireframe 20-laundry fidelity:
//  - 4 KPI strip (items out / returned / no activity / stalled)
//  - Filter pills (All, Items out, Items returned, No activity, Stalled)
//  - Single table sorted stalled → items-out → returned → no activity → roomNumber
//  - Stalled rows highlighted; chevron toggles inline expansion (item breakdown
//    + flagged-cycle deep-link).
//  - Logging happens on the HK PWA; this surface is read-only awareness +
//    owner-trigger fallback (kept from previous build).

type RoutineItem = {
  catalogItemId: string;
  name: string;
  unit: string;
  defaultQty: number;
};

type CycleItem = {
  catalogItemId: string;
  name: string;
  unit: string;
  qty: number;
  remainingQty: number;
};

type LaundryState = 'ITEMS_OUT' | 'ITEMS_RETURNED' | 'NO_ACTIVITY';

type LaundryRow = {
  roomId: string;
  roomNumber: string;
  roomType: string;
  cycleId: string | null;
  state: LaundryState;
  stateLabel: string;
  overdue: boolean;
  itemCount: number;
  loggedAt: string | null;
  cycleItems: CycleItem[];
  createdBy: string | null;
  createdByUserId: string | null;
  flagCount: number;
  flagHref: string;
};

type LaundryStatusResponse = {
  vendor: { name: string; contact: string | null };
  canMutate: boolean;
  routineItems: RoutineItem[];
  counts: { itemsOut: number; itemsReturned: number; noActivity: number; stalled: number };
  rows: LaundryRow[];
};

type FilterKey = 'all' | 'items-out' | 'items-returned' | 'no-activity' | 'stalled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All rooms' },
  { key: 'items-out', label: 'Items out' },
  { key: 'items-returned', label: 'Items returned' },
  { key: 'no-activity', label: 'No activity' },
  { key: 'stalled', label: 'Stalled (> 24h)' },
];

type PaneState = { roomId: string; roomNumber: string; hasOpenCycle: boolean } | null;

export function LaundryStatusClient() {
  const queryClient = useQueryClient();
  const [pane, setPane] = useState<PaneState>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['laundry-status'],
    queryFn: () => fetchJson<LaundryStatusResponse>('/api/laundry-logs/status'),
    refetchInterval: 30_000,
  });

  const trigger = useMutation({
    mutationFn: async (input: { roomId: string; appendToOpenCycle: boolean; items: Array<{ catalogItemId: string; qty: number }> }) =>
      fetchJson('/api/laundry-logs/owner-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setPane(null);
      await queryClient.invalidateQueries({ queryKey: ['laundry-status'] });
    },
  });

  const counts = data?.counts ?? { itemsOut: 0, itemsReturned: 0, noActivity: 0, stalled: 0 };

  const sortedRows = useMemo(() => {
    const all = data?.rows ?? [];
    const filtered = all.filter((r) => passesFilter(r, filter));
    return [...filtered].sort((a, b) => sortRank(a) - sortRank(b) || a.roomNumber.localeCompare(b.roomNumber));
  }, [data?.rows, filter]);

  return (
    <PageShell
      header={
        <PageHeader
          variant="list"
          title="Laundry Status"
          subtitle={`${data?.vendor.name ?? 'Laundry vendor'} cycle visibility by room`}
        />
      }
    >
      <section className="grid grid-cols-4 gap-3">
        <KpiCard label="Items out" value={counts.itemsOut} sub="Awaiting return" tone="amber" />
        <KpiCard label="Items returned" value={counts.itemsReturned} sub="Cycle complete today" tone="teal" />
        <KpiCard label="No activity" value={counts.noActivity} sub="No log today" />
        <KpiCard label="Stalled > 24h" value={counts.stalled} sub="Items still out" tone="coral" />
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const isActive = filter === f.key;
          const isStalled = f.key === 'stalled';
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? isStalled
                    ? 'border-[#F4C2A1] bg-[#FFF1EA] text-[#B5572A]'
                    : 'border-[#1DA888] bg-[#1DA888] text-white'
                  : isStalled
                    ? 'border-slate-200 bg-white text-[#B5572A] hover:bg-[#FFF1EA]/40'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <span className="ml-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
          Logging happens on PWA
        </span>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Laundry cycle by room</p>
            <p className="text-xs text-slate-500">
              {sortedRows.length} {sortedRows.length === 1 ? 'room' : 'rooms'} · sorted: stalled first, then items-out, then by room number
            </p>
          </div>
        </header>

        {isLoading ? <LaundrySkeleton /> : null}
        {!isLoading && sortedRows.length === 0 ? (
          <EmptyState
            icon={<Shirt className="size-6" />}
            heading="No rooms match this filter"
            body="Try a different filter or wait for the next cycle update."
            iconTone="gray"
          />
        ) : null}

        {sortedRows.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Room</th>
                <th className="px-5 py-2.5">State</th>
                <th className="px-5 py-2.5">Items</th>
                <th className="px-5 py-2.5">Last update</th>
                <th className="px-5 py-2.5">Logged by</th>
                <th className="px-5 py-2.5 text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <RowGroup
                  key={row.roomId}
                  row={row}
                  expanded={expanded === row.roomId}
                  onToggle={() => setExpanded((cur) => (cur === row.roomId ? null : row.roomId))}
                  canMutate={data?.canMutate ?? false}
                  onSend={() =>
                    setPane({ roomId: row.roomId, roomNumber: row.roomNumber, hasOpenCycle: row.state === 'ITEMS_OUT' })
                  }
                />
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-[11px] text-slate-500">
          <strong className="font-semibold text-slate-700">State definitions:</strong>{' '}
          Items out — pieces removed for laundry, awaiting return. · Items returned — cycle complete for today. · No activity — no log entry today. · Stalled — items out for &gt; 24h.
        </div>
      </section>

      {pane && data ? (
        <OwnerTriggerPane
          pane={pane}
          vendorName={data.vendor.name}
          items={data.routineItems}
          busy={trigger.isPending}
          error={trigger.error instanceof Error ? trigger.error.message : null}
          onClose={() => setPane(null)}
          onSubmit={(items, appendToOpenCycle) => trigger.mutate({ roomId: pane.roomId, appendToOpenCycle, items })}
        />
      ) : null}
    </PageShell>
  );
}

function passesFilter(row: LaundryRow, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'stalled') return row.overdue;
  if (filter === 'items-out') return row.state === 'ITEMS_OUT' && !row.overdue;
  if (filter === 'items-returned') return row.state === 'ITEMS_RETURNED';
  if (filter === 'no-activity') return row.state === 'NO_ACTIVITY';
  return true;
}

function sortRank(row: LaundryRow) {
  if (row.overdue) return 0;
  if (row.state === 'ITEMS_OUT') return 1;
  if (row.state === 'ITEMS_RETURNED') return 2;
  return 3;
}

function RowGroup({
  row,
  expanded,
  onToggle,
  canMutate,
  onSend,
}: {
  row: LaundryRow;
  expanded: boolean;
  onToggle: () => void;
  canMutate: boolean;
  onSend: () => void;
}) {
  const hasDetail = row.cycleItems.length > 0;
  return (
    <>
      <tr
        className={`border-t border-slate-100 ${
          row.overdue ? 'bg-[#FFF6F0]' : row.state === 'NO_ACTIVITY' ? 'bg-slate-50/30' : 'bg-white'
        }`}
      >
        <td className="px-5 py-3">
          <div className="text-base font-semibold text-slate-900">{row.roomNumber}</div>
          <div className="text-[11px] text-slate-500">{row.roomType}</div>
        </td>
        <td className="px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatePill state={row.state} overdue={row.overdue} label={row.stateLabel} />
            {row.flagCount > 0 ? (
              <Link
                href={row.flagHref}
                className="inline-flex min-h-6 items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 no-underline hover:bg-amber-200"
              >
                ⚑ {row.flagCount} flagged
              </Link>
            ) : null}
          </div>
        </td>
        <td className="px-5 py-3 text-sm text-slate-700">
          {row.state === 'NO_ACTIVITY' ? '—' : `${row.itemCount} ${row.itemCount === 1 ? 'piece' : 'pieces'}`}
        </td>
        <td className="px-5 py-3 text-sm">
          {row.loggedAt ? (
            <>
              <div className={`font-medium ${row.overdue ? 'text-amber-800' : 'text-slate-700'}`}>
                {timeSince(row.loggedAt)}
              </div>
              <div className="text-[11px] text-slate-500">{formatDateTime(row.loggedAt)}</div>
            </>
          ) : (
            <div className="text-slate-500">No log today</div>
          )}
        </td>
        <td className="px-5 py-3 text-sm text-slate-700">{row.createdBy ?? '—'}</td>
        <td className="px-5 py-3 text-right">
          {row.state === 'NO_ACTIVITY' ? (
            canMutate ? (
              <button
                type="button"
                onClick={onSend}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1DA888] hover:border-[#1DA888]"
              >
                + Send for laundry
              </button>
            ) : (
              <span className="text-[11px] font-medium text-slate-400">Read only</span>
            )
          ) : hasDetail ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? 'Collapse' : 'Expand'}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#1DA888] hover:bg-slate-100"
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {expanded ? 'Collapse' : 'View'}
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
      </tr>
      {expanded && hasDetail ? (
        <tr className="border-t border-slate-100 bg-slate-50/60">
          <td colSpan={6} className="px-5 py-4">
            <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {row.state === 'ITEMS_OUT' ? 'Items out' : 'Items in this cycle'}
                </p>
                <ul className="mt-2 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                  {row.cycleItems.map((it) => (
                    <li key={it.catalogItemId} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-700">
                        {it.name}
                        {it.unit ? <span className="ml-1 text-[11px] text-slate-400">({it.unit})</span> : null}
                      </span>
                      <span className="font-semibold text-slate-900">×{row.state === 'ITEMS_OUT' ? it.remainingQty : it.qty}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cycle timeline</p>
                <ul className="mt-2 space-y-2 rounded-md border border-slate-200 bg-white p-3">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="mt-1 size-2 rounded-full bg-[#1DA888]" />
                    <div>
                      <div className="font-medium text-slate-800">Items out</div>
                      <div className="text-[11px] text-slate-500">
                        {row.loggedAt ? formatDateTime(row.loggedAt) : '—'}
                        {row.createdBy ? ` · ${row.createdBy}` : ''}
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className={`mt-1 size-2 rounded-full ${row.state === 'ITEMS_RETURNED' ? 'bg-[#1DA888]' : row.overdue ? 'bg-orange-500' : 'bg-slate-300'}`} />
                    <div>
                      <div className="font-medium text-slate-800">
                        {row.state === 'ITEMS_RETURNED' ? 'Items returned' : 'Awaiting return'}
                      </div>
                      <div className={`text-[11px] ${row.overdue ? 'text-amber-800 font-medium' : 'text-slate-500'}`}>
                        {row.state === 'ITEMS_RETURNED'
                          ? 'Cycle closed'
                          : row.overdue
                            ? `${timeSince(row.loggedAt ?? new Date().toISOString())} elapsed — flagged stalled`
                            : 'In progress'}
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function StatePill({ state, overdue, label }: { state: LaundryState; overdue: boolean; label: string }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FEE6DD] px-2 py-0.5 text-[11px] font-bold text-[#A03A10]">
        <span className="size-1.5 rounded-full bg-[#A03A10]" /> Items out · stalled
      </span>
    );
  }
  if (state === 'ITEMS_OUT') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FFF3D6] px-2 py-0.5 text-[11px] font-bold text-[#8B6914]">
        <span className="size-1.5 rounded-full bg-[#8B6914]" /> {label}
      </span>
    );
  }
  if (state === 'ITEMS_RETURNED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF6F2] px-2 py-0.5 text-[11px] font-bold text-[#16876c]">
        <span className="size-1.5 rounded-full bg-[#16876c]" /> {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
      <span className="size-1.5 rounded-full bg-slate-400" /> {label}
    </span>
  );
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

function OwnerTriggerPane({
  pane,
  vendorName,
  items,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  pane: NonNullable<PaneState>;
  vendorName: string;
  items: RoutineItem[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (items: Array<{ catalogItemId: string; qty: number }>, appendToOpenCycle: boolean) => void;
}) {
  const [quantities, setQuantities] = useState(() => new Map(items.map((item) => [item.catalogItemId, item.defaultQty])));
  const [appendToOpenCycle, setAppendToOpenCycle] = useState(false);

  function setQty(catalogItemId: string, qty: number) {
    const next = new Map(quantities);
    next.set(catalogItemId, qty);
    setQuantities(next);
  }

  const payload = items.map((item) => ({ catalogItemId: item.catalogItemId, qty: quantities.get(item.catalogItemId) ?? 0 }));
  const canSubmit = payload.some((item) => item.qty > 0) && (!pane.hasOpenCycle || appendToOpenCycle);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25">
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Send for laundry</h2>
            <p className="text-sm text-slate-500">Room {pane.roomNumber} · {vendorName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Close">
            <X className="size-5" />
          </button>
        </div>

        {pane.hasOpenCycle ? (
          <label className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input type="checkbox" checked={appendToOpenCycle} onChange={(event) => setAppendToOpenCycle(event.target.checked)} className="mt-1 size-4" />
            <span>Append to the existing open laundry cycle for this room.</span>
          </label>
        ) : null}

        <div className="grid gap-3">
          {items.map((item) => (
            <label key={item.catalogItemId} className="grid grid-cols-[1fr_110px] items-center gap-3 rounded-lg border border-slate-200 p-3">
              <span>
                <span className="block text-sm font-semibold text-slate-900">{item.name}</span>
                <span className="text-xs text-slate-500">{item.unit}</span>
              </span>
              <input
                type="number"
                min="0"
                max="1000"
                value={quantities.get(item.catalogItemId) ?? 0}
                onChange={(event) => setQty(item.catalogItemId, Number(event.target.value))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-right"
              />
            </label>
          ))}
        </div>
        {items.length === 0 ? (
          <EmptyState icon={<PackageOpen className="size-6" />} heading="No routine linens" body="Routine linen catalog items appear here once configured." iconTone="gray" />
        ) : null}
        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <Button type="button" disabled={busy || !canSubmit} onClick={() => onSubmit(payload, appendToOpenCycle)} className="mt-5 w-full">
          <Send className="mr-2 size-4" />
          Submit
        </Button>
      </aside>
    </div>
  );
}

function LaundrySkeleton() {
  return (
    <div className="grid gap-3 p-5">
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-16 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

function timeSince(value: string) {
  const then = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h ago` : `${days}d ago`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Request failed');
  }
  return (await res.json()) as T;
}
