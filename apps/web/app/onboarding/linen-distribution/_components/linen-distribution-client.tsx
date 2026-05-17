// @ts-nocheck
'use client';

// Story 12.5 — Cold-Start Linen Distribution client.
// One card per linen CatalogItem with three inputs (inRooms / inLaundry /
// inStorage) constrained to sum to `totalOwned`. Live "remaining: N" shown
// per card. "Allocate per-room" expands an override grid (stepper per room).
// Save & Continue POSTs all items as one batch; Defer routes through the
// /defer endpoint and bounces back to /onboarding.

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { distributeFloorDivide } from '@/lib/services/cold-start-linen';

const TEAL = '#1DA888';
const CHARCOAL = '#1A2B2E';
const MUTED = '#9EAEAC';
const BORDER = '#E8EFEE';
const SOFT = '#F4F9F8';
const CORAL = '#B5572A';

type Item = {
  id: string;
  name: string;
  unit: string;
  linenCategory: string | null;
  roomTypeId: string | null;
  totalOwned: number;
  inRoomsSoFar: number;
};
type Room = { id: string; number: string; roomTypeId: string; floor: number | null };

type ItemDraft = {
  inRooms: string;
  inLaundry: string;
  inStorage: string;
  manualOpen: boolean;
  perRoom: Record<string, string>;
};

export function LinenDistributionClient({
  alreadyDeferred,
  items,
  rooms,
  isolatedItemId = null,
  startMode = null,
}: {
  alreadyDeferred: boolean;
  items: Item[];
  rooms: Room[];
  isolatedItemId?: string | null;
  startMode?: 'per-room' | null;
}) {
  const router = useRouter();

  // Initial draft per item — pre-fill inRooms from any prior seeding (so
  // re-entry after partial work surfaces the current state); split the rest
  // 50/50 between laundry and storage as a sensible default.
  const initialDraft = (it: Item): ItemDraft => {
    const inRooms = it.inRoomsSoFar;
    const remaining = Math.max(it.totalOwned - inRooms, 0);
    const inLaundry = Math.floor(remaining / 2);
    const inStorage = remaining - inLaundry;
    return {
      inRooms: String(inRooms),
      inLaundry: String(inLaundry),
      inStorage: String(inStorage),
      // AC4: when deep-linked with ?mode=per-room (12.6 re-deployment path),
      // open the per-room override immediately for the isolated item.
      manualOpen: startMode === 'per-room' && isolatedItemId === it.id,
      perRoom: {},
    };
  };

  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>(() =>
    Object.fromEntries(items.map((it) => [it.id, initialDraft(it)])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(id: string, patch: Partial<ItemDraft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id]!, ...patch } }));
  }
  function updatePerRoom(id: string, roomId: string, qty: string) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id]!, perRoom: { ...d[id]!.perRoom, [roomId]: qty } } }));
  }

  function eligibleRoomsFor(item: Item): Room[] {
    return item.roomTypeId ? rooms.filter((r) => r.roomTypeId === item.roomTypeId) : rooms;
  }

  function remaining(item: Item): number {
    const d = drafts[item.id]!;
    return item.totalOwned - (Number(d.inRooms) || 0) - (Number(d.inLaundry) || 0) - (Number(d.inStorage) || 0);
  }

  async function saveAll() {
    setError(null);

    // Build the payload + validate sums client-side for instant feedback.
    const payload: any = { items: [] };
    for (const item of items) {
      const d = drafts[item.id]!;
      const inRooms = Number(d.inRooms);
      const inLaundry = Number(d.inLaundry);
      const inStorage = Number(d.inStorage);
      if (![inRooms, inLaundry, inStorage].every((n) => Number.isFinite(n) && n >= 0)) {
        setError(`${item.name}: counts must be non-negative numbers.`);
        return;
      }
      if (inRooms + inLaundry + inStorage !== item.totalOwned) {
        setError(`${item.name}: distribution must total ${item.totalOwned}.`);
        return;
      }
      const entry: any = { catalogItemId: item.id, inRooms, inLaundry, inStorage };
      if (d.manualOpen) {
        const eligible = eligibleRoomsFor(item);
        const perRoom = eligible.map((r) => ({ roomId: r.id, qty: Number(d.perRoom[r.id] ?? '0') || 0 }));
        const perRoomSum = perRoom.reduce((a, b) => a + b.qty, 0);
        if (perRoomSum !== inRooms) {
          setError(`${item.name}: per-room total (${perRoomSum}) must equal in-rooms (${inRooms}).`);
          return;
        }
        entry.perRoom = perRoom;
      }
      payload.items.push(entry);
    }

    setBusy(true);
    try {
      const res = await fetch('/api/onboarding/linen-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.message ?? `Save failed (${res.status})`);
        return;
      }
      router.push('/onboarding');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function defer() {
    if (!confirm("Skip seeding for now? You can come back via /onboarding/linen-distribution. First-Shift Reconciliation won't auto-trigger until you seed.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/linen-distribution/defer', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.message ?? `Defer failed (${res.status})`);
        return;
      }
      router.push('/onboarding');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: SOFT, padding: '32px 28px 80px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
          Step 6 · sub-step · <span style={{ color: TEAL }}>Linen distribution</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: CHARCOAL, marginTop: 4 }}>
          Where is your linen right now?
        </h1>
        <p style={{ fontSize: 13.5, color: '#5C7170', marginTop: 8, lineHeight: 1.55, maxWidth: 720 }}>
          For each item, declare how it's currently split across rooms, laundry, and storage. We'll seed the
          per-room counts using a floor-divide (room 101 gets the +1 before 207) so housekeeping has a
          baseline to track drift against. Sums must equal each item's total owned.
        </p>

        {isolatedItemId ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(29,168,136,0.10)', border: `1px solid ${TEAL}`, color: '#0A4A38', fontSize: 12.5 }}>
            Re-confirming a single item from the First-Shift Reconciliation report. Adjust the declared split and save — only this item will be re-seeded.
          </div>
        ) : null}

        {alreadyDeferred ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: '#FFF8E6', border: '1px solid #E9C46A', color: '#6A4A0F', fontSize: 12.5 }}>
            You previously deferred this step. Save below to seed and clear the deferral; or close the tab to keep it deferred.
          </div>
        ) : null}

        {items.map((item) => {
          const d = drafts[item.id]!;
          const rem = remaining(item);
          const eligible = eligibleRoomsFor(item);
          const perRoomSum = d.manualOpen ? eligible.reduce((acc, r) => acc + (Number(d.perRoom[r.id] ?? '0') || 0), 0) : 0;
          const floorPreview = !d.manualOpen ? distributeFloorDivide(eligible, Number(d.inRooms) || 0) : null;

          return (
            <div key={item.id} style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 1px 3px rgba(26,43,46,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: CHARCOAL }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {item.linenCategory ? `${item.linenCategory} · ` : ''}{item.unit}
                    {item.roomTypeId ? ' · scoped to one room type' : ' · all rooms'}
                    {' · '}{eligible.length} eligible {eligible.length === 1 ? 'room' : 'rooms'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#5C7170', textTransform: 'uppercase', letterSpacing: 0.8 }}>Total owned</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: CHARCOAL, lineHeight: 1 }}>{item.totalOwned}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
                {(['inRooms', 'inLaundry', 'inStorage'] as const).map((field) => (
                  <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {field === 'inRooms' ? 'In rooms' : field === 'inLaundry' ? 'In laundry' : 'In storage'}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={d[field]}
                      onChange={(e) => updateDraft(item.id, { [field]: e.target.value } as any)}
                      style={{ padding: '10px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14 }}
                    />
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 12, color: rem === 0 ? '#0F7A5E' : CORAL, fontWeight: 600 }}>
                  {rem === 0 ? '✓ Distribution balanced' : `Remaining: ${rem}`}
                </span>
                <button
                  type="button"
                  onClick={() => updateDraft(item.id, { manualOpen: !d.manualOpen })}
                  style={{ background: 'transparent', border: 'none', color: TEAL, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {d.manualOpen ? 'Use floor-divide instead' : 'Allocate per-room'}
                </button>
              </div>

              {d.manualOpen ? (
                <div style={{ marginTop: 14, padding: 14, background: SOFT, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    Per-room override · sum must equal in-rooms ({d.inRooms || 0}) · current sum: {perRoomSum}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                    {eligible.map((r) => (
                      <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 8px' }}>
                        <span style={{ fontSize: 12, color: CHARCOAL, minWidth: 38 }}>{r.number}</span>
                        <input
                          type="number"
                          min={0}
                          value={d.perRoom[r.id] ?? '0'}
                          onChange={(e) => updatePerRoom(item.id, r.id, e.target.value)}
                          style={{ flex: 1, padding: '4px 6px', border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 13, textAlign: 'right' }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : floorPreview && eligible.length > 0 && Number(d.inRooms) > 0 ? (
                <div style={{ marginTop: 12, fontSize: 11.5, color: MUTED }}>
                  Floor-divide preview: {Math.floor((Number(d.inRooms) || 0) / eligible.length)} per room
                  {((Number(d.inRooms) || 0) % eligible.length) > 0
                    ? ` · first ${(Number(d.inRooms) || 0) % eligible.length} room${((Number(d.inRooms) || 0) % eligible.length) === 1 ? '' : 's'} (by number) get +1`
                    : ' (evenly divisible)'}
                </div>
              ) : null}
            </div>
          );
        })}

        {error ? (
          <div style={{ marginTop: 18, padding: 12, background: 'rgba(181,87,42,0.10)', border: `1px solid ${CORAL}`, borderRadius: 10, color: CORAL, fontSize: 12.5 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
          <button
            type="button"
            onClick={defer}
            disabled={busy}
            style={{ background: 'transparent', border: 'none', color: '#5C7170', fontSize: 13, textDecoration: 'underline', cursor: busy ? 'default' : 'pointer' }}
          >
            I'll seed this later
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={busy}
            style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
          >
            {busy ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
