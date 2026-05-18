'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, PackageCheck, Plus, X } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

type RoomStockItem = {
  catalogItemId: string;
  name: string;
  unit: string;
  par: number;
  lastRefillAt: string | null;
  storageAvailability: 'Healthy' | 'Low' | 'Out';
  storageLevel: number;
};

type RoomStockRoom = {
  roomId: string;
  roomNumber: string;
  roomType: string;
  items: RoomStockItem[];
};

type Staff = { id: string; name: string; phone: string };
type RoomStockResponse = { canMutate: boolean; staff: Staff[]; rooms: RoomStockRoom[] };

export function RoomStockClient() {
  const queryClient = useQueryClient();
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [paneOpen, setPaneOpen] = useState(false);
  const [filter, setFilter] = useState('');

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

  const rooms = useMemo(() => {
    const all = stock.data?.rooms ?? [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((room) => room.roomNumber.toLowerCase().includes(needle) || room.roomType.toLowerCase().includes(needle));
  }, [filter, stock.data?.rooms]);

  function toggleRoom(roomId: string) {
    const next = new Set(selectedRooms);
    if (next.has(roomId)) next.delete(roomId);
    else next.add(roomId);
    setSelectedRooms(next);
  }

  return (
    <PageShell
      header={
        <PageHeader
          variant="list"
          title="Room Stock"
          subtitle="Par, last refill, and storage availability by room"
          primary={
            stock.data?.canMutate ? (
              <Button type="button" disabled={selectedRooms.size === 0} onClick={() => setPaneOpen(true)}>
                <Plus className="mr-1 size-4" /> Generate REFILL
              </Button>
            ) : null
          }
        />
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter rooms"
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        />
        <p className="text-xs text-slate-500">No live in-room quantities are shown.</p>
      </div>

      {stock.isLoading ? <Skeleton /> : null}
      {!stock.isLoading && rooms.length === 0 ? (
        <EmptyState icon={<PackageCheck className="size-6" />} heading="No room stock data" body="Configured amenity par values appear here by room." iconTone="gray" />
      ) : null}

      <section className="grid gap-4">
        {rooms.map((room) => (
          <article key={room.roomId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {stock.data?.canMutate ? (
                  <input
                    type="checkbox"
                    checked={selectedRooms.has(room.roomId)}
                    onChange={() => toggleRoom(room.roomId)}
                    className="size-4"
                    aria-label={`Select room ${room.roomNumber}`}
                  />
                ) : null}
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Room {room.roomNumber}</h2>
                  <p className="text-xs text-slate-500">{room.roomType}</p>
                </div>
              </div>
              <Chip>{room.items.length} amenities</Chip>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Amenity</th>
                    <th className="px-3 py-2 text-right">Par</th>
                    <th className="px-3 py-2">Last refill</th>
                    <th className="px-3 py-2">Storage availability</th>
                  </tr>
                </thead>
                <tbody>
                  {room.items.map((item) => (
                    <tr key={item.catalogItemId} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{item.par} {item.unit}</td>
                      <td className="px-3 py-3 text-slate-600">{item.lastRefillAt ? new Date(item.lastRefillAt).toLocaleString('en-IN') : 'Not refilled yet'}</td>
                      <td className="px-3 py-3">
                        <Chip variant={item.storageAvailability === 'Healthy' ? 'positive' : item.storageAvailability === 'Low' ? 'caution' : 'negative'}>
                          {item.storageAvailability} · {item.storageLevel} in storage
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
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
          <select value={staffUserId} onChange={(event) => setStaffUserId(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 px-3">
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
    <div className="grid gap-4">
      {[0, 1, 2].map((key) => <div key={key} className="h-40 animate-pulse rounded-lg bg-white shadow-sm" />)}
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Request failed');
  }
  return (await res.json()) as T;
}
