// @ts-nocheck
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';

// Story 12.7f — Rate Management hub client. Three cards:
//   1. Floor Rate Configuration → PATCH /api/room-types/:id/rates
//   2. Rate Plans                → /api/rate-plans + /:id
//   3. Rate Multipliers          → /api/rate-multipliers + /:id (new in this slice)
// Floor rate is the only rate bound — there is no ceiling. Break-even is a
// non-blocking advisory; saving below break-even surfaces a warning, not a block.

const TEAL = '#1DA888';
const CHARCOAL = '#1A2B2E';
const MUTED = '#9EAEAC';
const BORDER = '#E8EFEE';
const SOFT = '#F4F9F8';
const CORAL = '#B5572A';

type RoomTypeRef = { id: string; name: string };
type FloorRow = {
  id: string;
  name: string;
  description: string;
  baseRate: number;
  floorRate: number;
  stateVersion: number;
  breakEvenRate: number | null;
};
type RatePlanRow = {
  id: string;
  name: string;
  roomTypeId: string;
  modifierType: 'FLAT' | 'PERCENTAGE';
  modifierValue: number;
};
type MultiplierRow = {
  id: string;
  name: string;
  type: 'SEASONAL' | 'CHANNEL';
  multiplier: number;
  startDate: string | null;
  endDate: string | null;
  channel: string | null;
  roomTypeIds: string[];
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function RateManagementClient({
  roomTypes,
  floorRows,
  ratePlans,
  multipliers,
}: {
  roomTypes: RoomTypeRef[];
  floorRows: FloorRow[];
  ratePlans: RatePlanRow[];
  multipliers: MultiplierRow[];
}) {
  return (
    <PageShell
      container="narrow"
      header={
        <PageHeader
          variant="minimal"
          eyebrow={[{ label: 'Settings', href: '/settings' }, { label: 'Rate Plans & Multipliers' }]}
          title="Rate Plans & Multipliers"
          subtitle="Set the floor rate per room type, then layer rate plans and seasonal / channel multipliers on top. Floor rate is the only rate bound — no rate plan or multiplier can sell below it."
        />
      }
    >
      <div className="flex flex-col gap-5">
        <FloorRateCard rows={floorRows} />
        <RatePlansCard initial={ratePlans} roomTypes={roomTypes} />
        <MultipliersCard initial={multipliers} roomTypes={roomTypes} />
      </div>
    </PageShell>
  );
}

// ── 1. Floor Rate Configuration ────────────────────────────────────────────
function FloorRateCard({ rows }: { rows: FloorRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.id, String(r.floorRate)])));
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(row: FloorRow) {
    const value = Number(draft[row.id]);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage('Enter a positive floor rate.');
      return;
    }
    setSaving(row.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/room-types/${row.id}/rates`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ floorRate: value, stateVersion: row.stateVersion }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err?.message ?? `Save failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card title="Floor Rate Configuration" subtitle="Story 5.3 / 5.4 · the absolute ₹ floor per room type — with live break-even guidance">
      <div style={{ padding: 20 }}>
        <ScopeBanner>
          <strong>Floor rate is the only rate bound.</strong> No ceiling — rate plans and multipliers can push tariffs as high as the market allows, but are always clamped at the floor. Break-even is a non-blocking reference: you may set a floor below it, but Gojo will warn you.
        </ScopeBanner>
        {rows.length === 0 ? <Empty>No room types yet. Add one in Settings → Room Types.</Empty> : null}
        {rows.map((row) => {
          const value = Number(draft[row.id] ?? row.floorRate);
          const belowBE = row.breakEvenRate !== null && value < row.breakEvenRate;
          return (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: `1px solid #F0F4F4` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{row.name}</div>
                {row.description ? <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{row.description}</div> : null}
              </div>
              <div style={{ fontSize: 12, color: '#5C7170', width: 110 }}>
                Rack rate<br /><strong style={{ color: CHARCOAL }}>{inr(row.baseRate)}</strong>
              </div>
              <div style={{ width: 140 }}>
                <input
                  type="number"
                  value={draft[row.id] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, textAlign: 'right', fontSize: 13 }}
                />
              </div>
              <div style={{ width: 190, fontSize: 11.5, color: '#5C7170' }}>
                {row.breakEvenRate !== null ? (
                  <>
                    Break-even ≈ <span style={{ fontWeight: 600, color: belowBE ? CORAL : '#0F7A5E' }}>{inr(row.breakEvenRate)}</span>
                    <br />
                    <span style={{ color: belowBE ? CORAL : MUTED }}>
                      {belowBE ? '⚠ Floor is below break-even' : 'Floor sits comfortably above'}
                    </span>
                  </>
                ) : (
                  <span style={{ color: MUTED }}>Break-even unavailable — configure costs first.</span>
                )}
              </div>
              <button onClick={() => save(row)} disabled={saving === row.id} style={btn(TEAL)}>
                {saving === row.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          );
        })}
        {message ? <div style={{ marginTop: 12, fontSize: 12, color: CORAL }}>{message}</div> : null}
      </div>
    </Card>
  );
}

// ── 2. Rate Plans ──────────────────────────────────────────────────────────
function RatePlansCard({ initial, roomTypes }: { initial: RatePlanRow[]; roomTypes: RoomTypeRef[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RatePlanRow | { id: null } | null>(null);
  const [form, setForm] = useState({ name: '', roomTypeId: '', modifierType: 'PERCENTAGE' as 'FLAT' | 'PERCENTAGE', modifierValue: '' });
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setEditing({ id: null });
    setForm({ name: '', roomTypeId: roomTypes[0]?.id ?? '', modifierType: 'PERCENTAGE', modifierValue: '' });
    setError(null);
  }
  function openEdit(row: RatePlanRow) {
    setEditing(row);
    setForm({ name: row.name, roomTypeId: row.roomTypeId, modifierType: row.modifierType, modifierValue: String(row.modifierValue) });
    setError(null);
  }

  async function save() {
    const payload = {
      name: form.name.trim(),
      roomTypeId: form.roomTypeId,
      modifierType: form.modifierType,
      modifierValue: Number(form.modifierValue),
    };
    if (!payload.name || !payload.roomTypeId || !Number.isFinite(payload.modifierValue) || payload.modifierValue <= 0) {
      setError('Fill all fields with valid values.');
      return;
    }
    if (payload.modifierType === 'PERCENTAGE' && payload.modifierValue > 100) {
      setError('PERCENTAGE must be 0–100.');
      return;
    }
    const url = editing && 'id' in editing && editing.id ? `/api/rate-plans/${editing.id}` : '/api/rate-plans';
    const method = editing && 'id' in editing && editing.id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err?.message ?? `Save failed (${res.status})`);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm('Delete this rate plan?')) return;
    const res = await fetch(`/api/rate-plans/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  const rtName = (id: string) => roomTypes.find((r) => r.id === id)?.name ?? '—';
  const fmtMod = (row: RatePlanRow) => (row.modifierType === 'FLAT' ? inr(row.modifierValue) : `+${row.modifierValue}%`);

  return (
    <Card
      title="Rate Plans"
      subtitle="Story 2.4 · named modifiers applied to a room type's base rate"
      actions={<button onClick={openNew} style={btn(TEAL, 'sm')}>+ Add rate plan</button>}
    >
      {initial.length === 0 ? <Empty>No rate plans yet.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAFCFC' }}>
              <Th>Plan name</Th><Th>Applies to</Th><Th>Modifier type</Th><Th align="right">Value</Th><Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {initial.map((row) => (
              <tr key={row.id} style={{ borderBottom: `1px solid #F0F4F4` }}>
                <Td><strong style={{ color: CHARCOAL }}>{row.name}</strong></Td>
                <Td>{rtName(row.roomTypeId)}</Td>
                <Td><Pill variant={row.modifierType === 'FLAT' ? 'purple' : 'blue'}>{row.modifierType}</Pill></Td>
                <Td align="right">{fmtMod(row)}</Td>
                <Td align="right">
                  <button onClick={() => openEdit(row)} style={btn('#fff', 'sm', CHARCOAL)}>Edit</button>{' '}
                  <button onClick={() => del(row.id)} style={btn('#fff', 'sm', CORAL)}>Delete</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing ? (
        <div style={inlineForm()}>
          <div style={inlineFormTitle()}>✎ {editing && 'id' in editing && editing.id ? 'Edit' : 'Add'} rate plan</div>
          <FieldGrid>
            <Field label="Plan name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input()} /></Field>
            <Field label="Applies to room type">
              <select value={form.roomTypeId} onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })} style={input()}>
                {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
              </select>
            </Field>
            <Field label="Modifier type">
              <Seg
                value={form.modifierType}
                options={[{ value: 'FLAT', label: 'FLAT ₹' }, { value: 'PERCENTAGE', label: 'PERCENTAGE %' }]}
                onChange={(v) => setForm({ ...form, modifierType: v as any })}
              />
            </Field>
            <Field label="Modifier value" hint={form.modifierType === 'PERCENTAGE' ? '0–100' : 'Positive ₹ amount'}>
              <input type="number" value={form.modifierValue} onChange={(e) => setForm({ ...form, modifierValue: e.target.value })} style={input()} />
            </Field>
          </FieldGrid>
          <ScopeBanner>The resulting rate is always clamped to the room type's <strong>floor rate</strong> — a rate plan can never sell below it.</ScopeBanner>
          {error ? <div style={{ color: CORAL, fontSize: 12, marginTop: 8 }}>{error}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button onClick={() => setEditing(null)} style={btn('#fff', undefined, CHARCOAL)}>Cancel</button>
            <button onClick={save} style={btn(TEAL)}>Save rate plan</button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

// ── 3. Rate Multipliers ────────────────────────────────────────────────────
function MultipliersCard({ initial, roomTypes }: { initial: MultiplierRow[]; roomTypes: RoomTypeRef[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<MultiplierRow | { id: null } | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'SEASONAL' as 'SEASONAL' | 'CHANNEL',
    multiplier: '',
    startDate: '',
    endDate: '',
    channel: 'Booking.com',
    scope: 'ALL' as 'ALL' | 'SPECIFIC',
    roomTypeIds: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setEditing({ id: null });
    setForm({ name: '', type: 'SEASONAL', multiplier: '', startDate: '', endDate: '', channel: 'Booking.com', scope: 'ALL', roomTypeIds: [] });
    setError(null);
  }
  function openEdit(row: MultiplierRow) {
    setEditing(row);
    setForm({
      name: row.name,
      type: row.type,
      multiplier: String(row.multiplier),
      startDate: row.startDate ? row.startDate.slice(0, 10) : '',
      endDate: row.endDate ? row.endDate.slice(0, 10) : '',
      channel: row.channel ?? 'Booking.com',
      scope: row.roomTypeIds.length === 0 ? 'ALL' : 'SPECIFIC',
      roomTypeIds: row.roomTypeIds,
    });
    setError(null);
  }

  async function save() {
    const mult = Number(form.multiplier);
    if (!form.name.trim() || !Number.isFinite(mult) || mult <= 0) {
      setError('Name and a positive multiplier are required.');
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      type: form.type,
      multiplier: mult,
      roomTypeIds: form.scope === 'ALL' ? [] : form.roomTypeIds,
    };
    if (form.type === 'SEASONAL') {
      if (!form.startDate || !form.endDate) { setError('Seasonal needs start + end dates.'); return; }
      payload.startDate = new Date(form.startDate).toISOString();
      payload.endDate = new Date(form.endDate).toISOString();
    } else {
      if (!form.channel) { setError('Channel name required.'); return; }
      payload.channel = form.channel;
    }
    const url = editing && 'id' in editing && editing.id ? `/api/rate-multipliers/${editing.id}` : '/api/rate-multipliers';
    const method = editing && 'id' in editing && editing.id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err?.message ?? `Save failed (${res.status})`);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm('Delete this multiplier?')) return;
    const res = await fetch(`/api/rate-multipliers/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  const fmtScope = (row: MultiplierRow) =>
    row.roomTypeIds.length === 0
      ? 'All room types'
      : row.roomTypeIds.map((id) => roomTypes.find((rt) => rt.id === id)?.name ?? '?').join(', ');

  const fmtTypeMeta = (row: MultiplierRow) => {
    if (row.type === 'SEASONAL' && row.startDate && row.endDate) {
      const fmt = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return `${fmt(row.startDate)} – ${fmt(row.endDate)}`;
    }
    if (row.type === 'CHANNEL' && row.channel) return row.channel;
    return '';
  };

  return (
    <Card
      title="Rate Multipliers"
      subtitle="Seasonal &amp; channel overrides that scale rates on top of plans"
      actions={<button onClick={openNew} style={btn(TEAL, 'sm')}>+ Add multiplier</button>}
    >
      {initial.length === 0 ? <Empty>No multipliers yet.</Empty> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAFCFC' }}>
              <Th>Name</Th><Th>Type</Th><Th>Multiplier</Th><Th>Applies to</Th><Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {initial.map((row) => (
              <tr key={row.id} style={{ borderBottom: `1px solid #F0F4F4` }}>
                <Td><strong style={{ color: CHARCOAL }}>{row.name}</strong></Td>
                <Td>
                  <Pill variant={row.type === 'SEASONAL' ? 'amber' : 'blue'}>{row.type}</Pill>{' '}
                  <span style={{ fontSize: 11, color: '#5C7170' }}>{fmtTypeMeta(row)}</span>
                </Td>
                <Td><Pill variant="teal">{row.multiplier}×</Pill></Td>
                <Td>{fmtScope(row)}</Td>
                <Td align="right">
                  <button onClick={() => openEdit(row)} style={btn('#fff', 'sm', CHARCOAL)}>Edit</button>{' '}
                  <button onClick={() => del(row.id)} style={btn('#fff', 'sm', CORAL)}>Delete</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing ? (
        <div style={inlineForm()}>
          <div style={inlineFormTitle()}>✎ {editing && 'id' in editing && editing.id ? 'Edit' : 'Add'} multiplier</div>
          <FieldGrid>
            <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input()} /></Field>
            <Field label="Multiplier" hint="Factor — e.g. 1.4 = +40%, 0.85 = -15%">
              <input type="number" step="0.01" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: e.target.value })} style={input()} />
            </Field>
          </FieldGrid>
          <div style={{ marginTop: 14 }}>
            <Field label="Multiplier type">
              <Seg value={form.type} options={[{ value: 'SEASONAL', label: 'SEASONAL — date range' }, { value: 'CHANNEL', label: 'CHANNEL — channel name' }]} onChange={(v) => setForm({ ...form, type: v as any })} />
            </Field>
          </div>
          {form.type === 'SEASONAL' ? (
            <FieldGrid style={{ marginTop: 14 }}>
              <Field label="Start date"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={input()} /></Field>
              <Field label="End date"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={input()} /></Field>
            </FieldGrid>
          ) : (
            <div style={{ marginTop: 14 }}>
              <Field label="Channel">
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} style={input()}>
                  {['Direct / Walk-in', 'Booking.com', 'MakeMyTrip', 'Goibibo', 'Agoda'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Field label="Applies to">
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as any, roomTypeIds: [] })} style={input()}>
                <option value="ALL">All room types</option>
                <option value="SPECIFIC">Specific room types…</option>
              </select>
            </Field>
            {form.scope === 'SPECIFIC' ? (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {roomTypes.map((rt) => {
                  const on = form.roomTypeIds.includes(rt.id);
                  return (
                    <label key={rt.id} style={{ display: 'inline-flex', gap: 6, fontSize: 12, color: CHARCOAL, padding: '4px 10px', border: `1px solid ${on ? TEAL : BORDER}`, borderRadius: 100, cursor: 'pointer', background: on ? '#D6F2EA' : '#fff' }}>
                      <input type="checkbox" checked={on} onChange={() => setForm((f) => ({ ...f, roomTypeIds: on ? f.roomTypeIds.filter((x) => x !== rt.id) : [...f.roomTypeIds, rt.id] }))} />
                      {rt.name}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
          <ScopeBanner>
            Multipliers stack on top of the resolved rate-plan price; the result is clamped to each room type's <strong>floor rate</strong>. A negative / off-season multiplier can never drop a rate below the floor.
          </ScopeBanner>
          {error ? <div style={{ color: CORAL, fontSize: 12, marginTop: 8 }}>{error}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button onClick={() => setEditing(null)} style={btn('#fff', undefined, CHARCOAL)}>Cancel</button>
            <button onClick={save} style={btn(TEAL)}>Save multiplier</button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────
function Card({ title, subtitle, actions, children }: any) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(26,43,46,0.05)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }} dangerouslySetInnerHTML={{ __html: subtitle }} /> : null}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function ScopeBanner({ children }: any) {
  return (
    <div style={{ background: SOFT, border: `1px solid #D6F2EA`, borderLeft: `3px solid ${TEAL}`, padding: '10px 14px', borderRadius: 6, fontSize: 12, color: '#0F7A5E', margin: '6px 0 14px' }}>
      {children}
    </div>
  );
}

function Empty({ children }: any) {
  return <div style={{ padding: 32, textAlign: 'center', color: MUTED, fontSize: 13 }}>{children}</div>;
}

function Th({ children, align = 'left' }: any) {
  return <th style={{ textAlign: align, padding: '10px 20px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${BORDER}` }}>{children}</th>;
}
function Td({ children, align = 'left' }: any) {
  return <td style={{ padding: '14px 20px', textAlign: align, verticalAlign: 'middle' }}>{children}</td>;
}

function Field({ label, hint, children }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</label>
      {children}
      {hint ? <span style={{ fontSize: 11, color: MUTED }}>{hint}</span> : null}
    </div>
  );
}
function FieldGrid({ children, style }: any) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', ...style }}>{children}</div>;
}

function Seg({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', background: value === o.value ? TEAL : '#fff', color: value === o.value ? '#fff' : '#5C7170', cursor: 'pointer', borderLeft: i === 0 ? 'none' : `1px solid ${BORDER}` }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Pill({ variant, children }: any) {
  const palette: Record<string, [string, string]> = {
    teal: ['#D6F2EA', '#0F7A5E'],
    amber: ['#FBF1D5', '#B5853A'],
    coral: ['#F7DCD0', '#B5572A'],
    blue: ['#DCE9F2', '#3A6FA0'],
    purple: ['#E6E0F2', '#6B53A0'],
    grey: ['#EEF2F2', '#5C7170'],
  };
  const [bg, fg] = palette[variant] ?? palette.grey;
  return <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: bg, color: fg }}>{children}</span>;
}

function input(): React.CSSProperties {
  return { padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: CHARCOAL, background: '#fff' };
}
function btn(bg: string, size?: 'sm', fg?: string): React.CSSProperties {
  return {
    padding: size === 'sm' ? '6px 12px' : '8px 16px',
    borderRadius: 8,
    fontSize: size === 'sm' ? 12 : 13,
    fontWeight: 600,
    border: bg === '#fff' ? `1px solid ${BORDER}` : '1px solid transparent',
    background: bg,
    color: fg ?? (bg === '#fff' ? CHARCOAL : '#fff'),
    cursor: 'pointer',
  };
}
function inlineForm(): React.CSSProperties {
  return { margin: '0 20px 20px', border: `1px dashed ${TEAL}`, borderRadius: 10, background: SOFT, padding: 18 };
}
function inlineFormTitle(): React.CSSProperties {
  return { fontSize: 13, fontWeight: 600, color: '#0F7A5E', marginBottom: 14 };
}
