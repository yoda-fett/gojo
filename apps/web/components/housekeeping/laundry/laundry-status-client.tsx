'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, PackageOpen, Send, Shirt, X } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

type RoutineItem = {
  catalogItemId: string;
  name: string;
  unit: string;
  defaultQty: number;
};

type LaundryRow = {
  roomId: string;
  roomNumber: string;
  cycleId: string | null;
  state: 'ITEMS_OUT' | 'ITEMS_RETURNED' | 'NO_ACTIVITY';
  stateLabel: string;
  overdue: boolean;
  itemCount: number;
  loggedAt: string | null;
  createdBy: string | null;
  createdByUserId: string | null;
  flagCount: number;
  flagHref: string;
};

type LaundryStatusResponse = {
  vendor: { name: string; contact: string | null };
  canMutate: boolean;
  routineItems: RoutineItem[];
  rows: LaundryRow[];
};

type PaneState = { roomId: string; roomNumber: string; hasOpenCycle: boolean } | null;

export function LaundryStatusClient() {
  const queryClient = useQueryClient();
  const [pane, setPane] = useState<PaneState>(null);
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

  const rows = data?.rows ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-8">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Laundry Status</h1>
          <p className="text-sm text-slate-500">{data?.vendor.name ?? 'Laundry vendor'} cycle visibility by room</p>
        </div>
      </header>

      {isLoading ? <LaundrySkeleton /> : null}
      {!isLoading && rows.length === 0 ? (
        <EmptyState icon={<Shirt className="size-6" />} heading="No rooms found" body="Laundry cycles appear here once rooms are configured." iconTone="gray" />
      ) : null}

      <section className="grid gap-3">
        {rows.map((row) => (
          <article
            key={row.roomId}
            className={`grid gap-3 rounded-lg border bg-white p-4 shadow-sm lg:grid-cols-[160px_1fr_180px_180px] lg:items-center ${
              row.overdue ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
            }`}
          >
            <div>
              <div className="text-lg font-semibold text-slate-950">Room {row.roomNumber}</div>
              <div className="mt-1 text-xs text-slate-500">{row.cycleId ? `Cycle ${row.cycleId.slice(0, 8)}` : 'No cycle'}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Chip variant={badgeVariant(row.state, row.overdue)}>{row.stateLabel}</Chip>
              <Chip>{row.itemCount} items</Chip>
              {row.createdBy ? <Chip variant="neutral">Created by {row.createdBy}</Chip> : null}
              {row.flagCount > 0 ? (
                <Link href={row.flagHref} className="inline-flex min-h-8 items-center rounded-[8px] bg-amber-100 px-3 text-xs font-semibold text-amber-800 no-underline hover:bg-amber-200">
                  {row.flagCount} items flagged
                </Link>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="size-4 text-slate-400" />
              <span>{row.loggedAt ? timeSince(row.loggedAt) : 'No activity'}</span>
              {row.overdue ? <span className="font-semibold text-amber-800">Over 24h</span> : null}
            </div>

            <div className="flex justify-start lg:justify-end">
              {data?.canMutate ? (
                <Button
                  type="button"
                  variant={row.state === 'ITEMS_OUT' ? 'secondary' : 'primary'}
                  className="min-h-10 px-3"
                  onClick={() => setPane({ roomId: row.roomId, roomNumber: row.roomNumber, hasOpenCycle: row.state === 'ITEMS_OUT' })}
                >
                  <Send className="mr-2 size-4" />
                  Send for laundry
                </Button>
              ) : (
                <span className="text-xs font-medium text-slate-500">Read only</span>
              )}
            </div>
          </article>
        ))}
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
    </main>
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
    <div className="grid gap-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
      ))}
    </div>
  );
}

function badgeVariant(state: LaundryRow['state'], overdue: boolean) {
  if (overdue) return 'caution';
  if (state === 'ITEMS_OUT') return 'caution';
  if (state === 'ITEMS_RETURNED') return 'positive';
  return 'neutral';
}

function timeSince(value: string) {
  const then = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - then);
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Request failed');
  }
  return (await res.json()) as T;
}
