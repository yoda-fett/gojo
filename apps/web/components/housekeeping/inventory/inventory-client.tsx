'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ImageIcon, Mic, PackagePlus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

// Hotfix-9 — wireframe 19-inventory fidelity. Three tabs, each with its own
// KPI strip + alert banner + filter toolbar + table. Pending Review carries
// the new evidence-chip pattern (audio + photo + text snippet) and inline
// reject reason. See [hotfix-9-inventory.md §3 Sally pass] for rationale.

type TabKey = 'amenities' | 'linens' | 'pending';

type AmenityRow = {
  id: string;
  name: string;
  unit: string;
  currentLevel: number;
  restockThreshold: number | null;
  roomTypeId: string | null;
  roomTypeName: string | null;
  expectedQtyPerStay: number | null;
  lastConsumedAt: string | null;
  statusBucket: 'Below' | 'Approaching' | 'OK';
};

type LinenRow = {
  id: string;
  name: string;
  unit: string;
  linenCategory: string | null;
  minPoolSize: number | null;
  totalOwned: number;
  inRooms: number;
  inLaundry: number;
  inStorage: number;
  cumulativeWriteOffs: number;
  stalled: number;
  statusBucket: 'BelowMin' | 'AtMin' | 'OK';
};

type RoomType = { id: string; name: string };

type LevelsResponse = {
  amenities: AmenityRow[];
  linens: LinenRow[];
  canMutate: boolean;
  roomTypes: RoomType[];
  counts: {
    amenities: { totalTracked: number; belowThreshold: number; approachingThreshold: number };
    linens: { inStorageTotal: number; inActiveRotation: number; stalledGt24h: number; belowMinPool: number };
    lastRestock: { at: string; itemName: string | null; qty: number } | null;
  };
};

type PendingCard = {
  id: string;
  attributionStream: 'ROOM_SHORTAGE' | 'LAUNDRY_SHORTAGE' | 'OTHER';
  entryContext: string;
  category: string;
  itemName: string;
  itemType: string | null;
  unit: string;
  qty: number;
  roomNumber: string | null;
  vendorName: string | null;
  voiceFileUrl: string | null;
  voiceSeconds: number | null;
  photoFileUrl: string | null;
  textNote: string | null;
  reportedAt: string;
  reporterName: string;
  sourceLabel: string;
  stateVersion: number;
};

type PendingResponse = {
  pendingCount: number;
  counts: { totalPending: number; roomShortage: number; laundryShortage: number; other: number; oldestPendingAt: string | null };
  roomShortage: PendingCard[];
  laundryShortage: PendingCard[];
  other: PendingCard[];
};

type PaneState =
  | { mode: 'arrival'; item: { id: string; name: string; itemType: 'AMENITY' | 'LINEN' } }
  | { mode: 'writeOff'; item: { id: string; name: string; itemType: 'AMENITY' | 'LINEN' } }
  | null;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'amenities', label: 'Amenities' },
  { key: 'linens', label: 'Linens' },
  { key: 'pending', label: 'Pending Review' },
];

export function InventoryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [pane, setPane] = useState<PaneState>(null);
  const activeTab = tabFrom(searchParams.get('tab'));
  // §3.1 dashboard deep-link: ?filter=below auto-applies the Below-threshold filter.
  const flaggedFilter = searchParams.get('filter') === 'below';

  const levels = useQuery({
    queryKey: ['inventory-levels'],
    queryFn: async () => fetchJson<LevelsResponse>('/api/inventory/levels'),
  });

  const pending = useQuery({
    queryKey: ['inventory-pending-review'],
    queryFn: async () => fetchJson<PendingResponse>('/api/inventory/pending-review'),
    refetchInterval: 30_000,
  });

  const canMutate = levels.data?.canMutate ?? false;
  const pendingCount = pending.data?.counts.totalPending ?? 0;

  function setTab(tab: TabKey) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function clearFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <PageShell
      header={<PageHeader variant="list" title="Inventory" subtitle="Amenities, linen pool, and owner review queue" />}
    >
      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTab(tab.key)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${
              activeTab === tab.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
            {tab.key === 'pending' && pendingCount > 0 ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pendingCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'amenities' ? (
        <AmenitiesTab
          data={levels.data}
          loading={levels.isLoading}
          canMutate={canMutate}
          flaggedFilter={flaggedFilter}
          onClearFilter={clearFilter}
          onAction={setPane}
        />
      ) : null}
      {activeTab === 'linens' ? (
        <LinensTab data={levels.data} loading={levels.isLoading} canMutate={canMutate} onAction={setPane} />
      ) : null}
      {activeTab === 'pending' ? (
        <PendingTab
          data={pending.data}
          loading={pending.isLoading}
          canMutate={canMutate}
          onReviewed={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['inventory-levels'] }),
              queryClient.invalidateQueries({ queryKey: ['inventory-pending-review'] }),
            ]);
          }}
        />
      ) : null}

      {pane ? (
        <InventoryPane
          pane={pane}
          onClose={() => setPane(null)}
          onSaved={async () => {
            setPane(null);
            await queryClient.invalidateQueries({ queryKey: ['inventory-levels'] });
          }}
        />
      ) : null}
    </PageShell>
  );
}

/* ─── Shared chrome ──────────────────────────────────────────────── */

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
  tone?: 'teal' | 'amber' | 'coral' | 'violet';
}) {
  const color =
    tone === 'teal'
      ? 'text-teal-700'
      : tone === 'amber'
        ? 'text-amber-600'
        : tone === 'coral'
          ? 'text-orange-600'
          : tone === 'violet'
            ? 'text-[#6D3FCE]'
            : 'text-slate-900';
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 ${textValue ? 'text-lg' : 'text-2xl'} font-bold ${color}`}>{textValue ?? value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function AlertBanner({
  tone = 'coral',
  message,
  ctaLabel,
  onCta,
}: {
  tone?: 'coral' | 'amber';
  message: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const palette =
    tone === 'amber'
      ? { wrap: 'border-amber-200 bg-amber-50', icon: 'bg-amber-500', text: 'text-amber-900', cta: 'border-amber-400 text-amber-700 hover:bg-amber-100' }
      : { wrap: 'border-orange-200 bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-900', cta: 'border-orange-300 text-orange-700 hover:bg-orange-100' };
  return (
    <div className={`mb-4 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${palette.wrap}`}>
      <div className="flex items-center gap-3">
        <span className={`flex size-7 items-center justify-center rounded-full text-sm font-bold text-white ${palette.icon}`}>!</span>
        <p className={`text-sm ${palette.text}`}>{message}</p>
      </div>
      {ctaLabel && onCta ? (
        <button type="button" onClick={onCta} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${palette.cta}`}>
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'border-[#1DA888] bg-[#1DA888] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Amenities tab ──────────────────────────────────────────────── */

function AmenitiesTab({
  data,
  loading,
  canMutate,
  flaggedFilter,
  onClearFilter,
  onAction,
}: {
  data: LevelsResponse | undefined;
  loading: boolean;
  canMutate: boolean;
  flaggedFilter: boolean;
  onClearFilter: () => void;
  onAction: (pane: PaneState) => void;
}) {
  const [search, setSearch] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [belowOnly, setBelowOnly] = useState(flaggedFilter);

  const counts = data?.counts.amenities ?? { totalTracked: 0, belowThreshold: 0, approachingThreshold: 0 };
  const lastRestock = data?.counts.lastRestock;

  const rows = useMemo(() => {
    const all = data?.amenities ?? [];
    const filtered = all.filter((row) => {
      if (belowOnly && row.statusBucket !== 'Below') return false;
      if (roomTypeFilter !== 'all' && row.roomTypeId !== roomTypeFilter) return false;
      if (search && !row.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return [...filtered].sort((a, b) => statusRank(a.statusBucket) - statusRank(b.statusBucket) || a.name.localeCompare(b.name));
  }, [data?.amenities, belowOnly, roomTypeFilter, search]);

  // Max for bar visualisation: comfortable cap so threshold lands ~80%.
  const maxLevel = useMemo(() => {
    const all = data?.amenities ?? [];
    return Math.max(1, ...all.map((r) => Math.max(r.currentLevel, (r.restockThreshold ?? 0) * 1.25)));
  }, [data?.amenities]);

  if (loading) return <GridSkeleton />;
  if ((data?.amenities ?? []).length === 0) {
    return <EmptyState icon={<PackagePlus className="size-6" />} heading="No amenities configured" body="Amenity catalog items appear here once configured." />;
  }

  return (
    <>
      {flaggedFilter && belowOnly ? (
        <AlertBanner
          message={
            <>
              <strong className="font-semibold">{counts.belowThreshold} items</strong> below restock threshold. Filtered to show low-stock first.
            </>
          }
          ctaLabel="Clear filter"
          onCta={() => {
            setBelowOnly(false);
            onClearFilter();
          }}
        />
      ) : null}

      <section className="grid grid-cols-4 gap-3">
        <KpiCard label="Total items tracked" value={counts.totalTracked} sub="Across catalogued amenities" />
        <KpiCard label="Below threshold" value={counts.belowThreshold} sub="Restock needed" tone="coral" />
        <KpiCard label="Approaching threshold" value={counts.approachingThreshold} sub="Within 20% of threshold" tone="amber" />
        <KpiCard
          label="Last restock entry"
          textValue={lastRestock ? relativeDay(lastRestock.at) : 'No restocks yet'}
          sub={lastRestock ? `${lastRestock.itemName ?? 'Item'} · +${lastRestock.qty} units` : 'Log an arrival to populate'}
          tone="teal"
        />
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="min-h-9 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs"
          />
        </div>
        <FilterPill active={roomTypeFilter === 'all'} onClick={() => setRoomTypeFilter('all')}>
          All room types
        </FilterPill>
        {data?.roomTypes.map((rt) => (
          <FilterPill key={rt.id} active={roomTypeFilter === rt.id} onClick={() => setRoomTypeFilter(rt.id)}>
            {rt.name}
          </FilterPill>
        ))}
        <FilterPill active={belowOnly} onClick={() => setBelowOnly((v) => !v)}>
          Below threshold only
        </FilterPill>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Stock levels</p>
            <p className="text-xs text-slate-500">{rows.length} of {counts.totalTracked} items · sorted: below threshold first</p>
          </div>
        </header>
        {rows.length === 0 ? (
          <EmptyState icon={<Search className="size-6" />} heading="No matches" body="Try a different filter or clear search." iconTone="gray" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Item</th>
                <th className="px-5 py-2.5">Room type</th>
                <th className="px-5 py-2.5">Current level</th>
                <th className="px-5 py-2.5 text-right">Threshold</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-slate-100 ${
                    row.statusBucket === 'Below' ? 'bg-[#FFF6F0]' : row.statusBucket === 'Approaching' ? 'bg-[#FFFCF1]' : 'bg-white'
                  }`}
                >
                  <td className="px-5 py-3 align-top">
                    <div className="text-sm font-semibold text-slate-900">{row.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {row.expectedQtyPerStay ? `${row.expectedQtyPerStay} / stay` : 'No par set'}
                      {row.lastConsumedAt ? ` · last consumed ${timeSince(row.lastConsumedAt)}` : ''}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-slate-600">{row.roomTypeName ?? 'All types'}</td>
                  <td className="px-5 py-3">
                    <StockLevelBar
                      level={row.currentLevel}
                      threshold={row.restockThreshold ?? 0}
                      max={maxLevel}
                      status={row.statusBucket}
                      unit={row.unit}
                    />
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-slate-700">{row.restockThreshold ?? '—'}</td>
                  <td className="px-5 py-3"><AmenityStatusPill bucket={row.statusBucket} /></td>
                  <td className="px-5 py-3 text-right">
                    {canMutate ? (
                      <div className="flex justify-end gap-1.5">
                        <RowActionBtn label="+ Restock" onClick={() => onAction({ mode: 'arrival', item: { id: row.id, name: row.name, itemType: 'AMENITY' } })} />
                        <RowActionBtn label="− Write-off" tone="danger" onClick={() => onAction({ mode: 'writeOff', item: { id: row.id, name: row.name, itemType: 'AMENITY' } })} />
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Read only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-[11px] text-slate-500">
          currentLevel = totalStocked − totalConsumed − write-offs · Restock action records a positive stock movement.
        </div>
      </section>
    </>
  );
}

function StockLevelBar({
  level,
  threshold,
  max,
  status,
  unit,
}: {
  level: number;
  threshold: number;
  max: number;
  status: 'Below' | 'Approaching' | 'OK';
  unit: string;
}) {
  const pct = Math.min(100, Math.max(0, (level / max) * 100));
  const thresholdPct = Math.min(100, Math.max(0, (threshold / max) * 100));
  const fill = status === 'Below' ? 'bg-[#E8763F]' : status === 'Approaching' ? 'bg-[#E9C46A]' : 'bg-[#1DA888]';
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-medium text-slate-700">
        {level} {unit}
      </div>
      <div className="relative h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
        {threshold > 0 ? (
          <span className="absolute top-[-2px] block h-3 w-[2px] bg-slate-500" style={{ left: `${thresholdPct}%` }} title={`Threshold ${threshold}`} />
        ) : null}
      </div>
    </div>
  );
}

function AmenityStatusPill({ bucket }: { bucket: 'Below' | 'Approaching' | 'OK' }) {
  const palette =
    bucket === 'Below'
      ? 'bg-[#FEE6DD] text-[#A03A10]'
      : bucket === 'Approaching'
        ? 'bg-[#FFF3D6] text-[#8B6914]'
        : 'bg-[#EAF6F2] text-[#16876c]';
  const label = bucket === 'Below' ? 'Below' : bucket === 'Approaching' ? 'Approaching' : 'OK';
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${palette}`}>{label}</span>;
}

function RowActionBtn({ label, tone, onClick }: { label: string; tone?: 'danger'; onClick: () => void }) {
  const cls =
    tone === 'danger'
      ? 'border-orange-200 text-orange-700 hover:bg-orange-50'
      : 'border-slate-200 text-slate-700 hover:border-[#1DA888] hover:text-[#1DA888]';
  return (
    <button type="button" onClick={onClick} className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${cls}`}>
      {label}
    </button>
  );
}

/* ─── Linens tab ─────────────────────────────────────────────────── */

function LinensTab({
  data,
  loading,
  canMutate,
  onAction,
}: {
  data: LevelsResponse | undefined;
  loading: boolean;
  canMutate: boolean;
  onAction: (pane: PaneState) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'below' | 'stalled'>('all');

  const counts = data?.counts.linens ?? { inStorageTotal: 0, inActiveRotation: 0, stalledGt24h: 0, belowMinPool: 0 };

  const rows = useMemo(() => {
    const all = data?.linens ?? [];
    const filtered = all.filter((row) => {
      if (filter === 'below' && row.statusBucket === 'OK') return false;
      if (filter === 'stalled' && row.stalled === 0) return false;
      if (search && !row.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return [...filtered].sort((a, b) => a.inStorage - b.inStorage || a.name.localeCompare(b.name));
  }, [data?.linens, filter, search]);

  if (loading) return <GridSkeleton />;
  if ((data?.linens ?? []).length === 0) {
    return <EmptyState icon={<PackagePlus className="size-6" />} heading="No linens configured" body="Linen catalog items appear here once configured." />;
  }

  const showAlert = counts.belowMinPool > 0 || counts.stalledGt24h > 0;

  return (
    <>
      {showAlert ? (
        <AlertBanner
          tone="amber"
          message={
            <>
              <strong className="font-semibold">
                {counts.belowMinPool > 0 ? `${counts.belowMinPool} linen${counts.belowMinPool > 1 ? 's' : ''} below min pool` : null}
                {counts.belowMinPool > 0 && counts.stalledGt24h > 0 ? ', ' : ''}
                {counts.stalledGt24h > 0 ? `${counts.stalledGt24h} pieces stuck in laundry > 24h` : null}.
              </strong>{' '}
              Inspect the at-risk linens below or jump to laundry status.
            </>
          }
          ctaLabel="View laundry stalls →"
          onCta={() => router.push('/housekeeping/laundry')}
        />
      ) : null}

      <section className="grid grid-cols-4 gap-3">
        <KpiCard label="In storage today" value={counts.inStorageTotal} sub="pieces · ready to deploy" />
        <KpiCard label="In active rotation" value={counts.inActiveRotation} sub="in occupied/dirty rooms" tone="teal" />
        <KpiCard label="Stuck in laundry > 24h" value={counts.stalledGt24h} sub="auto-flagged" tone="coral" />
        <KpiCard label="Below min pool" value={counts.belowMinPool} sub="restock or write-off review" tone="amber" />
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search linens…"
            className="min-h-9 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs"
          />
        </div>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>All linens</FilterPill>
        <FilterPill active={filter === 'below'} onClick={() => setFilter('below')}>Below min</FilterPill>
        <FilterPill active={filter === 'stalled'} onClick={() => setFilter('stalled')}>Stalled in laundry</FilterPill>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Linen pool — operational state</p>
            <p className="text-xs text-slate-500">{rows.length} of {data?.linens.length ?? 0} linens · sorted: storage low → high</p>
          </div>
          <p className="text-[11px] text-slate-500">
            Per-row actions: <code className="rounded bg-slate-100 px-1.5 py-0.5">+ Arrival</code> · <code className="rounded bg-slate-100 px-1.5 py-0.5">− Write-off</code>
          </p>
        </header>
        {rows.length === 0 ? (
          <EmptyState icon={<Search className="size-6" />} heading="No matches" body="Try a different filter or clear search." iconTone="gray" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Linen</th>
                <th className="px-5 py-2.5">In storage</th>
                <th className="px-5 py-2.5">Distribution</th>
                <th className="px-5 py-2.5 text-right">Min pool</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const atRisk = row.statusBucket !== 'OK' || row.stalled > 0;
                return (
                  <tr key={row.id} className={`border-t border-slate-100 ${atRisk ? 'bg-[#FFF6E8]' : 'bg-white'}`}>
                    <td className="px-5 py-3 align-top">
                      <div className="text-sm font-semibold text-slate-900">{row.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {row.linenCategory ?? 'Linen'} · {row.unit}
                        {row.cumulativeWriteOffs > 0 ? <span className="text-[#B5572A]"> · {row.cumulativeWriteOffs} written off</span> : null}
                      </div>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <strong className={`text-sm ${row.statusBucket === 'BelowMin' ? 'text-[#B5572A]' : 'text-slate-900'}`}>{row.inStorage} pieces</strong>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <DistributionBar inStorage={row.inStorage} inRooms={row.inRooms} inLaundry={row.inLaundry} stalled={row.stalled} />
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-slate-700">{row.minPoolSize ?? '—'}</td>
                    <td className="px-5 py-3 align-top"><LinenStatusPill bucket={row.statusBucket} /></td>
                    <td className="px-5 py-3 text-right align-top">
                      {canMutate ? (
                        <div className="flex justify-end gap-1.5">
                          <RowActionBtn label="+ Arrival" onClick={() => onAction({ mode: 'arrival', item: { id: row.id, name: row.name, itemType: 'LINEN' } })} />
                          <RowActionBtn label="− Write-off" tone="danger" onClick={() => onAction({ mode: 'writeOff', item: { id: row.id, name: row.name, itemType: 'LINEN' } })} />
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Read only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
          Distribution segments: <span className="font-semibold text-[#5C7170]">storage</span> · <span className="font-semibold text-[#1DA888]">rooms</span> · <span className="font-semibold text-[#B5853A]">laundry</span> · <span className="font-semibold text-[#E8763F]">stalled (&gt; 24h)</span>. Auto-updated from LaundryLog cycles.
        </div>
      </section>
    </>
  );
}

function DistributionBar({
  inStorage,
  inRooms,
  inLaundry,
  stalled,
}: {
  inStorage: number;
  inRooms: number;
  inLaundry: number;
  stalled: number;
}) {
  const safeStorage = Math.max(0, inStorage);
  const safeRooms = Math.max(0, inRooms);
  const safeLaundry = Math.max(0, inLaundry - stalled);
  const safeStalled = Math.max(0, stalled);
  const total = safeStorage + safeRooms + safeLaundry + safeStalled;
  if (total === 0) {
    return <div className="text-[11px] italic text-slate-400">No tracked pieces</div>;
  }
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {safeStorage > 0 ? <div className="bg-[#5C7170]" style={{ width: seg(safeStorage) }} title={`${safeStorage} storage`} /> : null}
        {safeRooms > 0 ? <div className="bg-[#1DA888]" style={{ width: seg(safeRooms) }} title={`${safeRooms} rooms`} /> : null}
        {safeLaundry > 0 ? <div className="bg-[#B5853A]" style={{ width: seg(safeLaundry) }} title={`${safeLaundry} laundry`} /> : null}
        {safeStalled > 0 ? <div className="bg-[#E8763F]" style={{ width: seg(safeStalled) }} title={`${safeStalled} stalled`} /> : null}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-600">
        {safeStorage > 0 ? <span><span className="mr-1 inline-block size-1.5 rounded-full bg-[#5C7170]" /><strong>{safeStorage}</strong> storage</span> : null}
        {safeRooms > 0 ? <span><span className="mr-1 inline-block size-1.5 rounded-full bg-[#1DA888]" /><strong>{safeRooms}</strong> rooms</span> : null}
        {safeLaundry > 0 ? <span><span className="mr-1 inline-block size-1.5 rounded-full bg-[#B5853A]" /><strong>{safeLaundry}</strong> laundry</span> : null}
        {safeStalled > 0 ? <span><span className="mr-1 inline-block size-1.5 rounded-full bg-[#E8763F]" /><strong>{safeStalled}</strong> stalled</span> : null}
      </div>
    </div>
  );
}

function LinenStatusPill({ bucket }: { bucket: 'BelowMin' | 'AtMin' | 'OK' }) {
  const palette =
    bucket === 'BelowMin'
      ? 'bg-[#FEE6DD] text-[#A03A10]'
      : bucket === 'AtMin'
        ? 'bg-[#FFF3D6] text-[#8B6914]'
        : 'bg-[#EAF6F2] text-[#16876c]';
  const label = bucket === 'BelowMin' ? 'Below min' : bucket === 'AtMin' ? 'At min' : 'OK';
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${palette}`}>{label}</span>;
}

/* ─── Pending Review tab ─────────────────────────────────────────── */

function PendingTab({
  data,
  loading,
  canMutate,
  onReviewed,
}: {
  data: PendingResponse | undefined;
  loading: boolean;
  canMutate: boolean;
  onReviewed: () => Promise<void>;
}) {
  const counts = data?.counts ?? { totalPending: 0, roomShortage: 0, laundryShortage: 0, other: 0, oldestPendingAt: null };

  if (loading) return <GridSkeleton />;
  if (!data || data.pendingCount === 0) {
    return (
      <EmptyState
        icon={<Check className="size-6" />}
        heading="Everything reviewed"
        body="Staff-flagged shortage candidates will appear here when raised from the PWA."
        iconTone="amber"
      />
    );
  }

  return (
    <>
      <section className="grid grid-cols-5 gap-3">
        <KpiCard label="Total pending" value={counts.totalPending} sub="awaiting your review" tone="coral" />
        <KpiCard label="Room shortage" value={counts.roomShortage} sub="guest-loss attribution" tone="amber" />
        <KpiCard label="Vendor shortage" value={counts.laundryShortage} sub="vendor-liability attribution" tone="violet" />
        <KpiCard label="Other / general" value={counts.other} sub="property + cold reports" />
        <KpiCard
          label="Oldest pending"
          textValue={counts.oldestPendingAt ? timeSince(counts.oldestPendingAt) : '—'}
          sub="Review queue aging"
        />
      </section>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[11px] leading-relaxed text-slate-600">
        <strong className="font-semibold text-slate-700">Why Pending Review lives on Inventory:</strong>{' '}
        write-offs mutate inventory; this is the natural destination. Cross-screen flow: dashboard alert → here → Laundry status flag chips deep-link back here, pre-filtered by cycle.
      </div>

      <PendingStream
        tone="amber"
        title="Room shortage"
        attribution="Guest-loss · attribution: GUEST_OR_IN_PROPERTY"
        sourceLabel="from staff PWA screens 6 (linen swap) & 9 (issue report)"
        cards={data.roomShortage}
        canMutate={canMutate}
        onReviewed={onReviewed}
      />
      <PendingStream
        tone="violet"
        title="Vendor / Laundry"
        attribution="Vendor-liability · attribution: LAUNDRY_VENDOR"
        sourceLabel="from staff PWA screen 8 (laundry receive)"
        cards={data.laundryShortage}
        canMutate={canMutate}
        onReviewed={onReviewed}
      />
      <PendingStream
        tone="slate"
        title="Other / general"
        attribution="No write-off · attribution: OTHER"
        sourceLabel="cold reports from PWA screen 9 (room or property-level)"
        cards={data.other}
        canMutate={canMutate}
        onReviewed={onReviewed}
      />
    </>
  );
}

function PendingStream({
  tone,
  title,
  attribution,
  sourceLabel,
  cards,
  canMutate,
  onReviewed,
}: {
  tone: 'amber' | 'violet' | 'slate';
  title: string;
  attribution: string;
  sourceLabel: string;
  cards: PendingCard[];
  canMutate: boolean;
  onReviewed: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const review = useMutation({
    mutationFn: async ({ action, ids, rejectReason }: { action: 'approve' | 'reject'; ids: string[]; rejectReason?: string | undefined }) => {
      const first = ids[0];
      if (!first) return;
      const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
      if (action === 'reject') init.body = JSON.stringify({ rejectReason });
      await fetchJson(`/api/issue-reports/${first}/${action}?ids=${ids.join(',')}`, init);
    },
    onSuccess: async () => {
      setSelected(new Set());
      await onReviewed();
      await queryClient.invalidateQueries({ queryKey: ['inventory-pending-review'] });
    },
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const palette =
    tone === 'amber'
      ? { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-800 border-amber-200', wrap: 'border-amber-200', accent: 'text-amber-900' }
      : tone === 'violet'
        ? { dot: 'bg-[#6D3FCE]', badge: 'bg-[#F1E4F8] text-[#6B2A8F] border-[#E2D0F0]', wrap: 'border-[#E2D0F0]', accent: 'text-[#6B2A8F]' }
        : { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700 border-slate-200', wrap: 'border-slate-200', accent: 'text-slate-800' };

  if (cards.length === 0) {
    return (
      <section className={`mt-5 rounded-xl border bg-white ${palette.wrap}`}>
        <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
          <span className={`size-2.5 rounded-full ${palette.dot}`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${palette.accent}`}>{title}</p>
            <p className="text-[11px] text-slate-500">0 items · {sourceLabel}</p>
          </div>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${palette.badge}`}>{attribution}</span>
        </header>
        <p className="px-5 py-6 text-center text-xs text-slate-500">No candidates in this stream.</p>
      </section>
    );
  }

  const selectedInStream = cards.filter((c) => selected.has(c.id)).length;

  return (
    <section className={`mt-5 overflow-hidden rounded-xl border bg-white ${palette.wrap}`}>
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
        <span className={`size-2.5 rounded-full ${palette.dot}`} />
        <div className="flex-1">
          <p className={`text-sm font-semibold ${palette.accent}`}>{title}</p>
          <p className="text-[11px] text-slate-500">{cards.length} items · {sourceLabel}</p>
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${palette.badge}`}>{attribution}</span>
      </header>
      {canMutate ? (
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/40 px-5 py-2 text-[11px]">
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={selectedInStream === cards.length && cards.length > 0}
              onChange={() => setSelected(selectedInStream === cards.length ? new Set() : new Set(cards.map((c) => c.id)))}
              className="size-3.5"
            />
            Select all in section
          </label>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{selectedInStream} of {cards.length} selected</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={selectedInStream === 0 || review.isPending}
              onClick={() => review.mutate({ action: 'reject', ids: Array.from(selected) })}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
            >
              Bulk reject
            </button>
            <button
              type="button"
              disabled={selectedInStream === 0 || review.isPending}
              onClick={() => review.mutate({ action: 'approve', ids: Array.from(selected) })}
              className="rounded-md border border-[#1DA888] bg-[#1DA888] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Bulk approve write-off
            </button>
          </div>
        </div>
      ) : null}
      <div className="divide-y divide-slate-100">
        {cards.map((card) => (
          <TriageCard
            key={card.id}
            card={card}
            selected={selected.has(card.id)}
            onToggle={() => toggle(card.id)}
            canMutate={canMutate}
            onApprove={() => review.mutate({ action: 'approve', ids: [card.id] })}
            onReject={(reason) => review.mutate({ action: 'reject', ids: [card.id], rejectReason: reason })}
            busy={review.isPending}
          />
        ))}
      </div>
    </section>
  );
}

function TriageCard({
  card,
  selected,
  onToggle,
  canMutate,
  onApprove,
  onReject,
  busy,
}: {
  card: PendingCard;
  selected: boolean;
  onToggle: () => void;
  canMutate: boolean;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  busy: boolean;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <article className={`grid gap-4 px-5 py-4 md:grid-cols-[28px_1.4fr_1.4fr_1.6fr_auto] md:items-start ${selected ? 'bg-[#F6FBFA]' : ''}`}>
      <div className="flex items-start">
        {canMutate ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="mt-1 size-4 rounded border-slate-300"
            aria-label={`Select ${card.itemName}`}
          />
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{card.itemName}</p>
        <p className="text-[11px] text-slate-500">× {card.qty} {card.category === 'DAMAGED' ? 'damaged' : 'missing'}</p>
        <p className="mt-2 text-[11px] text-slate-500">{formatDateTime(card.reportedAt)}</p>
      </div>

      <div className="min-w-0 text-[12px] text-slate-600">
        {card.roomNumber ? (
          <>
            <strong className="font-semibold text-slate-900">Room {card.roomNumber}</strong>
            <br />
          </>
        ) : card.vendorName ? (
          <>
            <strong className="font-semibold text-slate-900">{card.vendorName}</strong>
            <br />
          </>
        ) : null}
        <span className="text-slate-500">reported by {card.reporterName}</span>
        <br />
        <span className="text-[11px] text-[#B5853A]">source: {card.sourceLabel}</span>
      </div>

      <div className="flex flex-col gap-2">
        {card.voiceFileUrl ? (
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
            <Mic className="size-3.5 text-slate-500" />
            <audio src={card.voiceFileUrl} controls className="h-7 w-full" preload="none" controlsList="nodownload noremoteplayback noplaybackrate" />
            {card.voiceSeconds ? (
              <span className="ml-1 shrink-0 text-[11px] tabular-nums text-slate-500">{formatDuration(card.voiceSeconds)}</span>
            ) : null}
          </div>
        ) : null}
        {card.photoFileUrl ? (
          <a href={card.photoFileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2 hover:border-[#1DA888]">
            <ImageIcon className="size-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-700">View photo</span>
          </a>
        ) : null}
        {card.textNote ? (
          <p className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[12px] italic text-slate-700">&ldquo;{card.textNote}&rdquo;</p>
        ) : null}
        {!card.voiceFileUrl && !card.photoFileUrl && !card.textNote ? (
          <p className="text-[11px] text-slate-400">No voice · no photo · no note</p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-1.5">
        {canMutate ? (
          <>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="rounded-md border border-[#1DA888] bg-[#1DA888] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                Approve write-off
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRejectOpen((v) => !v)}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Reject {rejectOpen ? '▴' : '▾'}
              </button>
            </div>
            {rejectOpen ? (
              <div className="flex w-full flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50/60 p-2">
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Optional reason — e.g., 'will spot-treat once more'"
                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px]"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectOpen(false);
                      setRejectReason('');
                    }}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      onReject(rejectReason.trim() || undefined);
                      setRejectOpen(false);
                      setRejectReason('');
                    }}
                    className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Confirm reject
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-[11px] text-slate-400">Read only</span>
        )}
      </div>
    </article>
  );
}

/* ─── Inventory side pane (arrival / write-off) ──────────────────── */

// Write-off reasons — preset list per item type. Backend accepts a single
// string; we concatenate as "Reason — note" when a note is provided.
// "Other" reveals the note field automatically.
const LINEN_REASONS = ['Stained — unrecoverable', 'Torn / damaged', 'Lost / missing', 'Worn out', 'Burnt', 'Other'] as const;
const AMENITY_REASONS = ['Expired', 'Damaged in storage', 'Spilled / contaminated', 'Recalled', 'Other'] as const;

function InventoryPane({ pane, onClose, onSaved }: { pane: NonNullable<PaneState>; onClose: () => void; onSaved: () => Promise<void> }) {
  const isWriteOff = pane.mode === 'writeOff';
  const reasonOptions = pane.item.itemType === 'LINEN' ? LINEN_REASONS : AMENITY_REASONS;
  const [qty, setQty] = useState('1');
  const [reasonCategory, setReasonCategory] = useState<string>(reasonOptions[0]);
  const [reasonNote, setReasonNote] = useState('');
  const [reference, setReference] = useState('');
  const [sourceLocation, setSourceLocation] = useState<'STORAGE' | 'LAUNDRY_CYCLE'>('STORAGE');
  const [busy, setBusy] = useState(false);

  const isOther = reasonCategory === 'Other';
  const composedReason = isOther
    ? reasonNote.trim()
    : reasonNote.trim()
      ? `${reasonCategory} — ${reasonNote.trim()}`
      : reasonCategory;

  async function submit() {
    setBusy(true);
    try {
      const endpoint = isWriteOff ? '/api/inventory/write-offs' : '/api/inventory/arrivals';
      await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogItemId: pane.item.id,
          qty: Number(qty),
          ...(isWriteOff ? { reason: composedReason, sourceLocation } : { reference: reference || null }),
        }),
      });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25">
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{isWriteOff ? 'Write-off' : 'Arrival'}</h2>
            <p className="text-sm text-slate-500">{pane.item.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Close">
            <X className="size-5" />
          </button>
        </div>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Quantity {isWriteOff ? 'to write off' : ''}
          <input value={qty} onChange={(event) => setQty(event.target.value)} type="number" min="1" className="rounded-lg border border-slate-200 px-3 py-2" />
        </label>
        {isWriteOff ? (
          <>
            {pane.item.itemType === 'LINEN' ? (
              <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
                Source location
                <select value={sourceLocation} onChange={(event) => setSourceLocation(event.target.value as 'STORAGE' | 'LAUNDRY_CYCLE')} className="rounded-lg border border-slate-200 px-3 py-2">
                  <option value="STORAGE">Storage (default)</option>
                  <option value="LAUNDRY_CYCLE">Active laundry cycle</option>
                </select>
                <span className="text-[11px] text-slate-500">
                  If items were damaged during wash, pick the cycle so it&apos;s closed properly.
                </span>
              </label>
            ) : null}
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              Reason <span className="text-[#B5572A]">*</span>
              <select
                value={reasonCategory}
                onChange={(event) => setReasonCategory(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2"
              >
                {reasonOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              Note {isOther ? <span className="text-[#B5572A]">*</span> : <span className="text-xs font-normal text-slate-500">(optional)</span>}
              <input
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                placeholder={isOther ? 'Describe the reason' : 'Add context — e.g., "coffee stain near pillow"'}
                maxLength={240}
                className="rounded-lg border border-slate-200 px-3 py-2"
              />
              <span className="text-[11px] text-slate-500">
                Submitted as: <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">{composedReason || '—'}</code>
              </span>
            </label>
          </>
        ) : (
          <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
            Reference
            <input value={reference} onChange={(event) => setReference(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" />
          </label>
        )}
        <Button
          type="button"
          disabled={busy || (isWriteOff && composedReason.length === 0)}
          onClick={submit}
          className="mt-5 w-full"
        >
          <PackagePlus className="mr-2 size-4" /> {isWriteOff ? 'Record write-off' : 'Save'}
        </Button>
      </aside>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function statusRank(bucket: 'Below' | 'Approaching' | 'OK') {
  return bucket === 'Below' ? 0 : bucket === 'Approaching' ? 1 : 2;
}

function GridSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
      ))}
    </div>
  );
}

function tabFrom(value: string | null): TabKey {
  if (value === 'linens' || value === 'pending') return value;
  return 'amenities';
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
  return `${days}d ago`;
}

function relativeDay(value: string) {
  const then = new Date(value);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Request failed');
  }
  return (await res.json()) as T;
}

// Suppress unused-import warning for Link (kept for future deep-link use).
export const __keep = Link;
