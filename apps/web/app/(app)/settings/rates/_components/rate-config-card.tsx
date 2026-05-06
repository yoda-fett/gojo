// @ts-nocheck
'use client';

import { useState } from 'react';

import { BreakEvenInline } from '@/components/settings/break-even-inline';
import { BaseCard } from '@/components/ui/base-card';
import { Button } from '@/components/ui/button';
import { formatInr } from '@/lib/utils/currency';

export function RateConfigCard({ roomType }: { roomType: any }) {
  const [editing, setEditing] = useState(false);
  const [floorRate, setFloorRate] = useState(String(Number(roomType.floorRate)));
  const [ceilingRate, setCeilingRate] = useState(roomType.ceilingRate ? String(Number(roomType.ceilingRate)) : '');
  const [stateVersion, setStateVersion] = useState(roomType.stateVersion);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const floor = Number(floorRate || 0);
  const ceiling = ceilingRate ? Number(ceilingRate) : null;
  const invalidRange = Boolean(ceiling && floor > ceiling);

  async function saveRates() {
    setError(null);
    if (invalidRange) {
      setError('Floor rate must not exceed ceiling rate.');
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/room-types/${roomType.id}/rates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floorRate: floor,
        ceilingRate: ceiling || undefined,
        stateVersion,
      }),
    });

    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(response.status === 409 ? 'This room type changed in another session. Refresh and try again.' : payload.message ?? 'Unable to update rates.');
      return;
    }

    setStateVersion(payload.data.roomType.stateVersion);
    setEditing(false);
  }

  return (
    <BaseCard
      title={roomType.name}
      subtitle={`Rack rate ${formatInr(Number(roomType.baseRate))}`}
      controls={
        <Button variant={editing ? 'secondary' : 'primary'} onClick={() => setEditing((value) => !value)}>
          {editing ? 'Close' : 'Edit rates'}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[10px] border border-[#e8efee] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Rack Rate</p>
            <p className="mt-2 text-[16px] font-semibold text-[var(--color-charcoal)]">{formatInr(Number(roomType.baseRate))}</p>
          </div>
          <div className="rounded-[10px] border border-[#e8efee] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Floor Rate</p>
            <p className="mt-2 text-[16px] font-semibold text-[var(--color-charcoal)]">{formatInr(Number(floorRate || roomType.floorRate))}</p>
          </div>
          <div className="rounded-[10px] border border-[#e8efee] p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Ceiling Rate</p>
            <p className="mt-2 text-[16px] font-semibold text-[var(--color-charcoal)]">{ceilingRate ? formatInr(Number(ceilingRate)) : 'Not set'}</p>
          </div>
        </div>

        {editing ? (
          <div className="grid gap-4 rounded-[10px] border border-[#e8efee] bg-[#fbfdfc] p-4 md:grid-cols-2">
            <label className="space-y-2 text-[13px] font-medium">
              <span>Floor rate</span>
              <input type="number" min="1" className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={floorRate} onChange={(event) => setFloorRate(event.target.value)} />
            </label>
            <label className="space-y-2 text-[13px] font-medium">
              <span>Ceiling rate</span>
              <input type="number" min="1" className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3" value={ceilingRate} onChange={(event) => setCeilingRate(event.target.value)} placeholder="Optional" />
            </label>
          </div>
        ) : null}

        <BreakEvenInline roomTypeId={roomType.id} currentFloorRate={floor} />

        {error ? <p className="rounded-[10px] bg-[rgba(232,118,63,0.12)] px-4 py-3 text-[13px] text-[var(--color-coral)]">{error}</p> : null}

        {editing ? (
          <div className="flex flex-wrap gap-3">
            <Button onClick={saveRates} disabled={saving || invalidRange}>
              {saving ? 'Saving...' : 'Save rates'}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    </BaseCard>
  );
}
