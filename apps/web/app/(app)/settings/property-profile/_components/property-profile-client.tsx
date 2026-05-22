'use client';

import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';

// ─── shared tokens ──────────────────────────────────────────────────────────
const TEAL = '#1DA888';
const CHARCOAL = '#1A2B2E';
const BORDER = '#E8EFEE';
const MUTED = '#9EAEAC';
const ERR = '#B5572A';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  marginBottom: 16,
};
const cardHeader: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: `1px solid ${BORDER}`,
  fontSize: 14,
  fontWeight: 600,
  color: CHARCOAL,
};
const cardBody: React.CSSProperties = { padding: '16px 18px' };
const cardFooter: React.CSSProperties = {
  padding: '12px 18px',
  borderTop: `1px solid ${BORDER}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 10,
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#5C7170', display: 'block', marginBottom: 4 };
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  color: CHARCOAL,
  fontFamily: 'inherit',
};
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 14,
};

function btn(kind: 'primary' | 'ghost', disabled?: boolean): React.CSSProperties {
  return {
    padding: '7px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer',
    border: kind === 'ghost' ? `1px solid ${BORDER}` : 'none',
    background: kind === 'primary' ? TEAL : '#fff',
    color: kind === 'primary' ? '#fff' : '#5C7170',
    opacity: disabled ? 0.6 : 1,
  };
}

// ─── types ──────────────────────────────────────────────────────────────────
type PropertyData = {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPhone: string | null;
  contactEmail: string | null;
  gstin: string | null;
  pan: string | null;
  stateCode: string | null;
  currency: string;
  timezone: string;
  numberOfFloors: number | null;
  defaultCheckInTime: string | null;
  defaultCheckOutTime: string | null;
  routineCleaningIntervalDays: number;
};

type FieldType = 'text' | 'email' | 'time' | 'number';
type FieldDef = {
  key: keyof PropertyData;
  label: string;
  type?: FieldType;
  placeholder?: string;
  helper?: string;
  min?: number;
  max?: number;
};

type Policy = {
  id: string;
  name: string;
  description: string | null;
  windowHours: number;
  penaltyType: 'NONE' | 'FIRST_NIGHT' | 'PERCENTAGE' | 'FULL';
  penaltyValue: number | null;
  isDefault: boolean;
};

// ─── a single PATCH-backed card (Identity / Legal & tax / Operations) ───────
function PatchCard({
  title,
  fields,
  initial,
  propertyId,
  children,
}: {
  title: string;
  fields: FieldDef[];
  initial: PropertyData;
  propertyId: string;
  children?: React.ReactNode;
}) {
  const pick = (src: PropertyData) =>
    Object.fromEntries(fields.map((f) => [f.key, src[f.key] ?? '']));

  const [saved, setSaved] = useState(pick(initial));
  const [draft, setDraft] = useState(pick(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dirty = fields.some((f) => String(draft[f.key] ?? '') !== String(saved[f.key] ?? ''));

  async function save() {
    setBusy(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        if (String(draft[f.key] ?? '') === String(saved[f.key] ?? '')) continue;
        const raw = draft[f.key];
        if (f.type === 'number') {
          payload[f.key] = raw === '' || raw == null ? null : Number(raw);
        } else {
          payload[f.key] = typeof raw === 'string' && raw.trim() === '' ? null : raw;
        }
      }
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'Could not save changes');
      // Re-seed from the server echo so normalization (empty → null) sticks.
      const next = pick({ ...initial, ...data.property } as PropertyData);
      setSaved(next);
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={cardHeader}>{title}</div>
      <div style={cardBody}>
        <div style={gridStyle}>
          {fields.map((f) => (
            <div key={String(f.key)}>
              <label style={labelStyle} htmlFor={`pp-${String(f.key)}`}>
                {f.label}
              </label>
              <input
                id={`pp-${String(f.key)}`}
                style={inputStyle}
                type={f.type === 'time' ? 'time' : f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                value={draft[f.key] ?? ''}
                placeholder={f.placeholder ?? ''}
                min={f.type === 'number' ? f.min : undefined}
                max={f.type === 'number' ? f.max : undefined}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
              {f.helper ? (
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>{f.helper}</div>
              ) : null}
            </div>
          ))}
        </div>
        {children}
        {error ? <div style={{ marginTop: 12, color: ERR, fontSize: 12.5, fontWeight: 500 }}>{error}</div> : null}
      </div>
      <div style={cardFooter}>
        <button type="button" style={btn('ghost', !dirty || busy)} disabled={!dirty || busy} onClick={() => setDraft(saved)}>
          Cancel
        </button>
        <button
          type="button"
          style={btn('primary', !dirty || busy)}
          disabled={!dirty || busy}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── cancellation policies card ─────────────────────────────────────────────
const PENALTY_TYPES: Policy['penaltyType'][] = ['NONE', 'FIRST_NIGHT', 'PERCENTAGE', 'FULL'];
const emptyForm = {
  id: '',
  name: '',
  description: '',
  windowHours: '24',
  penaltyType: 'NONE' as Policy['penaltyType'],
  penaltyValue: '',
  isDefault: false,
};

function CancellationPoliciesCard({ initial }: { initial: Policy[] }) {
  const [policies, setPolicies] = useState<Policy[]>(initial);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const res = await fetch('/api/cancellation-policies');
    if (res.ok) setPolicies(await res.json());
  }

  async function submit() {
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        windowHours: Number(form.windowHours),
        penaltyType: form.penaltyType,
        isDefault: form.isDefault,
      };
      if (form.description.trim()) body.description = form.description.trim();
      if (form.penaltyType === 'PERCENTAGE') body.penaltyValue = Number(form.penaltyValue);
      const res = await fetch(
        form.id ? `/api/cancellation-policies/${form.id}` : '/api/cancellation-policies',
        {
          method: form.id ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'Could not save policy');
      await refresh();
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save policy');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/cancellation-policies/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Could not delete policy');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete policy');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Policy) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      windowHours: String(p.windowHours),
      penaltyType: p.penaltyType,
      penaltyValue: p.penaltyValue != null ? String(p.penaltyValue) : '',
      isDefault: p.isDefault,
    });
  }

  return (
    <div style={cardStyle}>
      <div style={{ ...cardHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Cancellation policies</span>
        {!form ? (
          <button type="button" style={btn('primary', busy)} disabled={busy} onClick={() => setForm({ ...emptyForm })}>
            + Add policy
          </button>
        ) : null}
      </div>
      <div style={cardBody}>
        {policies.length === 0 && !form ? (
          <div style={{ fontSize: 13, color: MUTED }}>No cancellation policies yet.</div>
        ) : null}

        {form ? (
          <div style={{ marginBottom: 14, padding: 14, background: '#F4F9F8', borderRadius: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: CHARCOAL, marginBottom: 10 }}>
              {form.id ? 'Edit policy' : 'New policy'}
            </div>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Policy name</label>
                <input
                  style={inputStyle}
                  value={form.name}
                  placeholder="e.g. Corporate Flexible"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Window (hours)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.windowHours}
                  onChange={(e) => setForm({ ...form, windowHours: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Penalty type</label>
                <select
                  style={inputStyle}
                  value={form.penaltyType}
                  onChange={(e) => setForm({ ...form, penaltyType: e.target.value as Policy['penaltyType'] })}
                >
                  {PENALTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {form.penaltyType === 'PERCENTAGE' ? (
                <div>
                  <label style={labelStyle}>Penalty value (%)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    value={form.penaltyValue}
                    onChange={(e) => setForm({ ...form, penaltyValue: e.target.value })}
                  />
                </div>
              ) : null}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Description (optional)</label>
                <input
                  style={inputStyle}
                  value={form.description}
                  placeholder="Short note shown to front desk when selecting this policy"
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12.5, color: '#5C7170' }}>
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Set as the default policy (exactly one per property — this clears the previous default)
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button
                type="button"
                style={btn('primary', busy || !form.name.trim())}
                disabled={busy || !form.name.trim()}
                onClick={() => void submit()}
              >
                {busy ? 'Saving…' : 'Save policy'}
              </button>
            </div>
          </div>
        ) : null}

        {policies.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 0',
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>
                {p.name}
                {p.isDefault ? (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(29,168,136,0.12)',
                      color: '#0F7A5E',
                    }}
                  >
                    DEFAULT
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 12, color: '#5C7170', marginTop: 2 }}>
                Within {p.windowHours}h · {p.penaltyType}
                {p.penaltyType === 'PERCENTAGE' && p.penaltyValue != null ? ` (${p.penaltyValue}%)` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={() => startEdit(p)}>
                Edit
              </button>
              <button
                type="button"
                style={btn('ghost', busy)}
                disabled={busy}
                onClick={() => void remove(p.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {error ? <div style={{ marginTop: 12, color: ERR, fontSize: 12.5, fontWeight: 500 }}>{error}</div> : null}
      </div>
    </div>
  );
}

// ─── top-level ──────────────────────────────────────────────────────────────
export function PropertyProfileClient({
  propertyId,
  property,
  archetype,
  initialPolicies,
}: {
  propertyId: string;
  property: PropertyData;
  archetype: string | null;
  initialPolicies: Policy[];
}) {
  return (
    <PageShell
      container="narrow"
      header={
        <PageHeader
          variant="minimal"
          eyebrow={[{ label: 'Settings', href: '/settings' }, { label: 'Property Profile' }]}
          title="Property Profile"
          subtitle={
            <>
              Update your property profile. Capture property attributes. Define{' '}
              <strong>Cancellation policy</strong> to charge customers on cancellation.
            </>
          }
        />
      }
    >
      <PatchCard
        title="Property identity"
        propertyId={propertyId}
        initial={property}
        fields={[
          { key: 'name', label: 'Property name' },
          { key: 'address', label: 'Address' },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
          { key: 'pincode', label: 'PIN code' },
          { key: 'contactPhone', label: 'Contact phone' },
          { key: 'contactEmail', label: 'Contact email', type: 'email' },
        ]}
      >
        <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              background: '#F4F9F8',
              border: `1px dashed ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: MUTED,
            }}
          >
            Photo
          </div>
          <div style={{ fontSize: 12.5, color: '#5C7170' }}>
            <div style={{ fontWeight: 600, color: CHARCOAL }}>
              Property type · {archetype ? archetype.replace(/_/g, ' ').toLowerCase() : 'not set'}
            </div>
            <div style={{ marginTop: 2 }}>
              Archetype drives break-even estimates — managed in the new Rate Management screen (12.7f).
            </div>
            <div style={{ marginTop: 2, color: MUTED }}>Photo upload — coming soon.</div>
          </div>
        </div>
      </PatchCard>

      <PatchCard
        title="Legal &amp; tax"
        propertyId={propertyId}
        initial={property}
        fields={[
          { key: 'gstin', label: 'GST registration number (GSTIN)', placeholder: '15-character GSTIN' },
          { key: 'pan', label: 'PAN' },
          { key: 'stateCode', label: 'State code', placeholder: 'e.g. 27' },
        ]}
      />

      <PatchCard
        title="Operations"
        propertyId={propertyId}
        initial={property}
        fields={[
          { key: 'defaultCheckInTime', label: 'Default check-in time', type: 'time' },
          { key: 'defaultCheckOutTime', label: 'Default check-out time', type: 'time' },
          { key: 'currency', label: 'Currency' },
          { key: 'timezone', label: 'Timezone' },
          { key: 'numberOfFloors', label: 'Number of floors', type: 'number' },
          {
            key: 'routineCleaningIntervalDays',
            label: 'Routine cleaning interval (days)',
            type: 'number',
            min: 1,
            max: 90,
            helper: 'Automatically flags a long-vacant room for a routine clean once it has sat unused this many days.',
          },
        ]}
      />

      <CancellationPoliciesCard initial={initialPolicies} />
    </PageShell>
  );
}
