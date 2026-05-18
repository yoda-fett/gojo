'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ImageIcon, PackagePlus, Play, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

type TabKey = 'amenities' | 'linens' | 'pending';

type AmenityRow = {
  id: string;
  name: string;
  unit: string;
  currentLevel: number;
  restockThreshold: number | null;
  status: 'Healthy' | 'Below Threshold';
};

type LinenRow = {
  id: string;
  name: string;
  unit: string;
  linenCategory: string | null;
  totalOwned: number;
  inRooms: number;
  inLaundry: number;
  inStorage: number;
  cumulativeWriteOffs: number;
};

type InventoryResponse = {
  amenities: AmenityRow[];
  linens: LinenRow[];
  canMutate: boolean;
};

type PendingCard = {
  id: string;
  attributionStream: string;
  itemName: string;
  itemType: string | null;
  unit: string;
  qty: number;
  roomNumber: string | null;
  vendorName: string | null;
  voiceFileUrl: string | null;
  photoFileUrl: string | null;
  textNote: string | null;
  reportedAt: string;
};

type PendingResponse = {
  pendingCount: number;
  roomShortage: PendingCard[];
  laundryShortage: PendingCard[];
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const activeTab = tabFrom(searchParams.get('tab'));

  const levels = useQuery({
    queryKey: ['inventory-levels'],
    queryFn: async () => fetchJson<InventoryResponse>('/api/inventory/levels'),
  });

  const pending = useQuery({
    queryKey: ['inventory-pending-review'],
    queryFn: async () => fetchJson<PendingResponse>('/api/inventory/pending-review'),
    refetchInterval: 30_000,
  });

  const canMutate = levels.data?.canMutate ?? false;
  const pendingCount = pending.data?.pendingCount ?? 0;

  function setTab(tab: TabKey) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const reviewMutation = useMutation({
    mutationFn: async ({ action, ids, rejectReason }: { action: 'approve' | 'reject'; ids: string[]; rejectReason?: string }) => {
      const first = ids[0];
      if (!first) return;
      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };
      if (action === 'reject') init.body = JSON.stringify({ rejectReason });
      await fetchJson(`/api/issue-reports/${first}/${action}?ids=${ids.join(',')}`, init);
    },
    onSuccess: async () => {
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-levels'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-pending-review'] }),
      ]);
    },
  });

  const bulkActions = selected.size > 0 && activeTab === 'pending' && canMutate ? (
    <div className="flex gap-2">
      <Button
        type="button"
        onClick={() => reviewMutation.mutate({ action: 'approve', ids: Array.from(selected) })}
      >
        <Check className="mr-2 size-4" /> Approve
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => reviewMutation.mutate({ action: 'reject', ids: Array.from(selected) })}
      >
        <X className="mr-2 size-4" /> Reject
      </Button>
    </div>
  ) : null;

  return (
    <PageShell
      header={
        <PageHeader
          variant="list"
          title="Inventory"
          subtitle="Amenities, linen pool, and owner review queue"
          controls={bulkActions}
        />
      }
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
            {tab.key === 'pending' ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pendingCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'amenities' ? (
        <AmenitiesTab rows={levels.data?.amenities ?? []} canMutate={canMutate} onAction={setPane} loading={levels.isLoading} />
      ) : null}
      {activeTab === 'linens' ? (
        <LinensTab rows={levels.data?.linens ?? []} canMutate={canMutate} onAction={setPane} loading={levels.isLoading} />
      ) : null}
      {activeTab === 'pending' ? (
        <PendingTab
          data={pending.data}
          selected={selected}
          canMutate={canMutate}
          onSelectedChange={setSelected}
          onAction={(action, id) => reviewMutation.mutate({ action, ids: [id] })}
          loading={pending.isLoading}
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

function AmenitiesTab({
  rows,
  canMutate,
  onAction,
  loading,
}: {
  rows: AmenityRow[];
  canMutate: boolean;
  onAction: (pane: PaneState) => void;
  loading: boolean;
}) {
  if (loading) return <GridSkeleton />;
  if (rows.length === 0) return <EmptyState icon={<PackagePlus className="size-6" />} heading="No amenities configured" body="Amenity catalog items appear here once configured." />;

  return (
    <section className="grid gap-3">
      {rows.map((row) => (
        <article key={row.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_120px_150px_210px] md:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">{row.name}</h2>
            <p className="text-xs text-slate-500">{row.unit}</p>
          </div>
          <Metric label="Current" value={row.currentLevel} />
          <Metric label="Threshold" value={row.restockThreshold ?? '-'} />
          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
            <Chip variant={row.status === 'Healthy' ? 'positive' : 'caution'}>{row.status}</Chip>
            {canMutate ? (
              <>
                <IconButton label="Arrival" onClick={() => onAction({ mode: 'arrival', item: { id: row.id, name: row.name, itemType: 'AMENITY' } })} />
                <IconButton label="Write-off" onClick={() => onAction({ mode: 'writeOff', item: { id: row.id, name: row.name, itemType: 'AMENITY' } })} />
              </>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}

function LinensTab({
  rows,
  canMutate,
  onAction,
  loading,
}: {
  rows: LinenRow[];
  canMutate: boolean;
  onAction: (pane: PaneState) => void;
  loading: boolean;
}) {
  if (loading) return <GridSkeleton />;
  if (rows.length === 0) return <EmptyState icon={<PackagePlus className="size-6" />} heading="No linens configured" body="Linen catalog items appear here once configured." />;

  return (
    <section className="grid gap-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">{row.name}</h2>
              <p className="text-xs text-slate-500">{row.linenCategory ?? 'Linen'} · {row.unit}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Metric label="Owned" value={row.totalOwned} />
              <Metric label="Rooms" value={row.inRooms} />
              <Metric label="Laundry" value={row.inLaundry} />
              <Metric label="Storage" value={row.inStorage} />
              <Metric label="Write-offs" value={row.cumulativeWriteOffs} />
            </div>
            {canMutate ? (
              <div className="flex gap-2">
                <IconButton label="Arrival" onClick={() => onAction({ mode: 'arrival', item: { id: row.id, name: row.name, itemType: 'LINEN' } })} />
                <IconButton label="Write-off" onClick={() => onAction({ mode: 'writeOff', item: { id: row.id, name: row.name, itemType: 'LINEN' } })} />
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}

function PendingTab({
  data,
  selected,
  canMutate,
  onSelectedChange,
  onAction,
  loading,
}: {
  data: PendingResponse | undefined;
  selected: Set<string>;
  canMutate: boolean;
  onSelectedChange: (next: Set<string>) => void;
  onAction: (action: 'approve' | 'reject', id: string) => void;
  loading: boolean;
}) {
  const sections = useMemo(
    () => [
      { key: 'room', title: 'Room shortage', tone: 'amber', rows: data?.roomShortage ?? [] },
      { key: 'laundry', title: 'Vendor + Laundry', tone: 'violet', rows: data?.laundryShortage ?? [] },
    ],
    [data],
  );

  if (loading) return <GridSkeleton />;
  if (!data || data.pendingCount === 0) return <EmptyState icon={<Check className="size-6" />} heading="No pending review" body="Staff-flagged shortage candidates will appear here." iconTone="amber" />;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  }

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      {sections.map((section) => (
        <div key={section.key} className={`rounded-lg border bg-white p-4 shadow-sm ${section.tone === 'amber' ? 'border-amber-200' : 'border-violet-200'}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={`text-sm font-semibold ${section.tone === 'amber' ? 'text-amber-900' : 'text-violet-900'}`}>{section.title}</h2>
            <Chip variant={section.tone === 'amber' ? 'caution' : 'neutral'}>{section.rows.length}</Chip>
          </div>
          <div className="grid gap-3">
            {section.rows.map((card) => (
              <article key={card.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  {canMutate ? (
                    <input
                      type="checkbox"
                      checked={selected.has(card.id)}
                      onChange={() => toggle(card.id)}
                      className="mt-1 size-4 rounded border-slate-300"
                      aria-label={`Select ${card.itemName}`}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-950">{card.itemName}</h3>
                      <Chip>{card.qty} {card.unit}</Chip>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {card.roomNumber ? `Room ${card.roomNumber}` : card.vendorName ? card.vendorName : 'Source pending'}
                    </p>
                    {card.textNote ? <p className="mt-2 text-sm text-slate-700">{card.textNote}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {card.voiceFileUrl ? <EvidenceButton icon={<Play className="size-4" />} label="Voice" href={card.voiceFileUrl} /> : null}
                      {card.photoFileUrl ? <EvidenceButton icon={<ImageIcon className="size-4" />} label="Photo" href={card.photoFileUrl} /> : null}
                    </div>
                  </div>
                  {canMutate ? (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" title="Approve" onClick={() => onAction('approve', card.id)} className="rounded-md p-2 text-teal-700 hover:bg-teal-50">
                        <Check className="size-4" />
                      </button>
                      <button type="button" title="Reject" onClick={() => onAction('reject', card.id)} className="rounded-md p-2 text-orange-700 hover:bg-orange-50">
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            {section.rows.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No candidates in this stream.</p> : null}
          </div>
        </div>
      ))}
    </section>
  );
}

function InventoryPane({ pane, onClose, onSaved }: { pane: NonNullable<PaneState>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [sourceLocation, setSourceLocation] = useState<'STORAGE' | 'LAUNDRY_CYCLE'>('STORAGE');
  const [busy, setBusy] = useState(false);
  const isWriteOff = pane.mode === 'writeOff';

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
          ...(isWriteOff ? { reason, sourceLocation } : { reference: reference || null }),
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
          Quantity
          <input value={qty} onChange={(event) => setQty(event.target.value)} type="number" min="1" className="rounded-lg border border-slate-200 px-3 py-2" />
        </label>
        {isWriteOff ? (
          <>
            {pane.item.itemType === 'LINEN' ? (
              <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
                Source location
                <select value={sourceLocation} onChange={(event) => setSourceLocation(event.target.value as 'STORAGE' | 'LAUNDRY_CYCLE')} className="rounded-lg border border-slate-200 px-3 py-2">
                  <option value="STORAGE">Storage</option>
                  <option value="LAUNDRY_CYCLE">Laundry cycle</option>
                </select>
              </label>
            ) : null}
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              Reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="rounded-lg border border-slate-200 px-3 py-2" />
            </label>
          </>
        ) : (
          <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
            Reference
            <input value={reference} onChange={(event) => setReference(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" />
          </label>
        )}
        <Button type="button" disabled={busy || (isWriteOff && !reason.trim())} onClick={submit} className="mt-5 w-full">
          <PackagePlus className="mr-2 size-4" /> Save
        </Button>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700">
      <PackagePlus className="size-4" />
    </button>
  );
}

function EvidenceButton({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
      {icon}
      {label}
    </a>
  );
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Request failed');
  }
  return (await res.json()) as T;
}
