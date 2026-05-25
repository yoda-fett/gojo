'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, PackageCheck, Plus, X } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

// Hotfix-8 Phase C — wireframe 21-room-stock fidelity:
//  - 4-KPI strip (Fully stocked / Low / Out / Last refill sweep)
//  - Alert banner shown when low > 0 or out > 0
//  - 4 filter pills (All / Out / Low / Fully) sorted out → low → fully
//  - Single table with per-row colour-coded item chips (qty/par)
//  - Per-row + Refill action triggers single-room refill via existing bulk endpoint

type ItemStatus = 'empty' | 'low' | 'ok';

type RoomStockItem = {
  catalogItemId: string;
  name: string;
  unit: string;
  par: number;
  currentQty: number;
  itemStatus: ItemStatus;
  lastRefillAt: string | null;
  storageAvailability: 'Healthy' | 'Low' | 'Out';
  storageLevel: number;
};

type RoomStatus = 'full' | 'low' | 'out';

type RoomStockRoom = {
  roomId: string;
  roomNumber: string;
  roomType: string;
  status: RoomStatus;
  lastRefillAt: string | null;
  items: RoomStockItem[];
};

type Staff = { id: string; name: string; phone: string };

type RoomStockResponse = {
  canMutate: boolean;
  staff: Staff[];
  counts: { fullyStocked: number; lowStock: number; outOfStock: number; total: number };
  lastRefillSweep: { at: string } | null;
  rooms: RoomStockRoom[];
};

type FilterKey = 'all' | 'out' | 'low' | 'full';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All rooms' },
  { key: 'out', label: 'Out of stock' },
  { key: 'low', label: 'Low stock' },
  { key: 'full', label: 'Fully stocked' },
];

export function RoomStockClient() {
  const queryClient = useQueryClient();
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [paneOpen, setPaneOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const stock = useQuery({
    queryKey: ['room-stock'],
    queryFn: () => fetchJson<RoomStockResponse>('/api/housekeeping/room-stock'),
  });

  const bulk = useMutation({
    mutationFn: async (body: { roomIds: string[]; staffUserId?: string }) =>
      fetchJson('/api/room-assignments/refill-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      setPaneOpen(false);
      setSelectedRooms(new Set());
      await queryClient.invalidateQueries({ queryKey: ['room-stock'] });
    },
  });

  const counts = stock.data?.counts ?? { fullyStocked: 0, lowStock: 0, outOfStock: 0, total: 0 };
  const flaggedCount = counts.outOfStock + counts.lowStock;

  const rows = useMemo(() => {
    const all = stock.data?.rooms ?? [];
    const filtered = all.filter((r) => passesFilter(r, filter));
    return [...filtered].sort((a, b) => sortRank(a) - sortRank(b) || a.roomNumber.localeCompare(b.roomNumber));
  }, [stock.data?.rooms, filter]);

  function toggleRoom(roomId: string) {
    const next = new Set(selectedRooms);
    if (next.has(roomId)) next.delete(roomId);
    else next.add(roomId);
    setSelectedRooms(next);
  }

  function refillOne(roomId: string, staffUserId?: string) {
    bulk.mutate({ roomIds: [roomId], ...(staffUserId ? { staffUserId } : {}) });
  }

  return (
    <PageShell
      header={
        <PageHeader
          variant="list"
          title="Room Stock"
          subtitle="Per-room consumable state · auto-updated from ConsumptionLog"
          primary={
            stock.data?.canMutate ? (
              <Button type="button" disabled={selectedRooms.size === 0} onClick={() => setPaneOpen(true)}>
                <Plus className="mr-1 size-4" /> Generate refill ({selectedRooms.size})
              </Button>
            ) : null
          }
        />
      }
    >
      {flaggedCount > 0 ? (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
              !
            </span>
            <p className="text-sm text-orange-900">
              <strong className="font-semibold">{flaggedCount} rooms</strong> have items below par —{' '}
              <strong className="font-semibold">{counts.outOfStock}</strong> are completely out of at least one item.
              Generate refill assignments to dispatch staff.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilter(counts.outOfStock > 0 ? 'out' : 'low')}
            className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
          >
            Filter to flagged →
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-4 gap-3">
        <KpiCard label="Rooms fully stocked" value={counts.fullyStocked} sub={`of ${counts.total} active rooms`} tone="teal" />
        <KpiCard label="Rooms with low items" value={counts.lowStock} sub="below expected qty" tone="amber" />
        <KpiCard label="Rooms out-of-stock" value={counts.outOfStock} sub="at zero on ≥ 1 item" tone="coral" />
        <KpiCard
          label="Last refill sweep"
          textValue={stock.data?.lastRefillSweep?.at ? relativeDay(stock.data.lastRefillSweep.at) : 'No refills yet'}
          sub={stock.data?.lastRefillSweep?.at ? formatDateTime(stock.data.lastRefillSweep.at) : 'Run a refill sweep to populate'}
        />
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const isActive = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'border-[#1DA888] bg-[#1DA888] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {f.label}
              {f.key !== 'all' ? (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {countFor(f.key, counts)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Room consumable state</p>
            <p className="text-xs text-slate-500">{counts.total} active rooms · sorted out → low → fully stocked</p>
          </div>
          <p className="text-[11px] text-slate-500">
            <strong className="font-semibold text-slate-700">Bulk action:</strong> Generate refill creates a RoomAssignment with taskTypes=[REFILL] for selected rooms.
          </p>
        </header>

        {stock.isLoading ? <Skeleton /> : null}
        {!stock.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={<PackageCheck className="size-6" />}
            heading="No rooms match this filter"
            body="Try a different filter or wait for the next state update."
            iconTone="gray"
          />
        ) : null}

        {rows.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                {stock.data?.canMutate ? <th className="px-3 py-2.5" /> : null}
                <th className="px-3 py-2.5">Room</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Current stock vs expected</th>
                <th className="px-3 py-2.5">Last refilled</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((room) => {
                const flagged = room.status !== 'full';
                const rowBg = room.status === 'out' ? 'bg-[#FFF6F0]' : room.status === 'low' ? 'bg-[#FFFCF1]' : 'bg-white';
                return (
                  <tr key={room.roomId} className={`border-t border-slate-100 ${rowBg}`}>
                    {stock.data?.canMutate ? (
                      <td className="px-3 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={selectedRooms.has(room.roomId)}
                          onChange={() => toggleRoom(room.roomId)}
                          className="size-4"
                          aria-label={`Select room ${room.roomNumber}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-3 align-top">
                      <div className="text-base font-semibold text-slate-900">{room.roomNumber}</div>
                      <div className="text-[11px] text-slate-500">{room.roomType}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <StatusPill status={room.status} />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {room.items.map((it) => (
                          <ItemChip key={it.catalogItemId} item={it} />
                        ))}
                        {room.items.length === 0 ? (
                          <span className="text-[11px] italic text-slate-400">No amenities configured</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-[11px] text-slate-500">
                      {room.lastRefillAt ? relativeDay(room.lastRefillAt) : 'Not refilled yet'}
                    </td>
                    <td className="px-3 py-3 text-right align-top">
                      {stock.data?.canMutate ? (
                        flagged ? (
                          <button
                            type="button"
                            onClick={() => refillOne(room.roomId, stock.data?.staff[0]?.id)}
                            disabled={bulk.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-[#1DA888] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700 disabled:bg-slate-300"
                          >
                            + Refill
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">All good</span>
                        )
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">Read only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}

        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
          Item chips: <span className="text-teal-700 font-semibold">teal = at expected</span>, <span className="text-amber-600 font-semibold">amber = below expected</span>, <span className="text-orange-600 font-semibold">coral = at zero</span>. Refill creates a RoomAssignment with taskTypes=[REFILL] for the selected room(s) — visible to staff in the HK app.
        </div>
      </section>

      {paneOpen && stock.data ? (
        <BulkRefillPane
          selectedCount={selectedRooms.size}
          staff={stock.data.staff}
          busy={bulk.isPending}
          error={bulk.error instanceof Error ? bulk.error.message : null}
          onClose={() => setPaneOpen(false)}
          onSubmit={(staffUserId) => {
            const body: { roomIds: string[]; staffUserId?: string } = { roomIds: Array.from(selectedRooms) };
            if (staffUserId) body.staffUserId = staffUserId;
            bulk.mutate(body);
          }}
        />
      ) : null}
    </PageShell>
  );
}

function passesFilter(room: RoomStockRoom, filter: FilterKey) {
  if (filter === 'all') return true;
  if (filter === 'out') return room.status === 'out';
  if (filter === 'low') return room.status === 'low';
  if (filter === 'full') return room.status === 'full';
  return true;
}

function sortRank(room: RoomStockRoom) {
  if (room.status === 'out') return 0;
  if (room.status === 'low') return 1;
  return 2;
}

function countFor(key: FilterKey, counts: { fullyStocked: number; lowStock: number; outOfStock: number; total: number }) {
  if (key === 'all') return counts.total;
  if (key === 'out') return counts.outOfStock;
  if (key === 'low') return counts.lowStock;
  return counts.fullyStocked;
}

function ItemChip({ item }: { item: RoomStockItem }) {
  const tone = item.itemStatus === 'empty'
    ? 'bg-[#FEE6DD] text-[#A03A10] border-[#F4C2A1]'
    : item.itemStatus === 'low'
      ? 'bg-[#FFF3D6] text-[#8B6914] border-[#F0DCA0]'
      : 'bg-[#EAF6F2] text-[#16876c] border-[#B8E5D6]';
  return (
    <span
      title={`${item.name}: ${item.currentQty} of ${item.par} ${item.unit}`}
      className={`inline-flex items-baseline gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {item.name}
      <span className="font-bold">{item.currentQty}</span>
      <span className="text-[10px] opacity-75">/ {item.par}</span>
    </span>
  );
}

function StatusPill({ status }: { status: RoomStatus }) {
  if (status === 'out') {
    return <span className="inline-flex items-center rounded-md bg-[#FEE6DD] px-2 py-0.5 text-[11px] font-bold text-[#A03A10]">Out of stock</span>;
  }
  if (status === 'low') {
    return <span className="inline-flex items-center rounded-md bg-[#FFF3D6] px-2 py-0.5 text-[11px] font-bold text-[#8B6914]">Low stock</span>;
  }
  return <span className="inline-flex items-center rounded-md bg-[#EAF6F2] px-2 py-0.5 text-[11px] font-bold text-[#16876c]">Fully stocked</span>;
}

function KpiCard({
  label,
  value,
  textValue,
  sub,
  tone,
}: {
  label: string;
  value?: number;
  textValue?: string;
  sub: string;
  tone?: 'teal' | 'amber' | 'coral';
}) {
  const color =
    tone === 'teal' ? 'text-teal-700' : tone === 'amber' ? 'text-amber-600' : tone === 'coral' ? 'text-orange-600' : 'text-slate-900';
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 ${textValue ? 'text-lg' : 'text-2xl'} font-bold ${color}`}>{textValue ?? value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function BulkRefillPane({
  selectedCount,
  staff,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  selectedCount: number;
  staff: Staff[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (staffUserId?: string) => void;
}) {
  const [staffUserId, setStaffUserId] = useState(staff[0]?.id ?? '');
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25">
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Generate REFILL tasks</h2>
            <p className="text-sm text-slate-500">{selectedCount} selected rooms</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Close">
            <X className="size-5" />
          </button>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Staff for unassigned rooms
          <select
            value={staffUserId}
            onChange={(event) => setStaffUserId(event.target.value)}
            className="min-h-11 rounded-lg border border-slate-200 px-3"
          >
            {staff.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-xs text-slate-500">Existing assignments keep their current assignee. REFILL is appended once.</p>
        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <Button type="button" disabled={busy || selectedCount === 0} onClick={() => onSubmit(staffUserId || undefined)} className="mt-5 w-full">
          <CheckSquare className="mr-2 size-4" /> Generate
        </Button>
      </aside>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-2 p-5">
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-14 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

function relativeDay(value: string) {
  const then = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
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
