'use client';

import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';

// ─── tokens ─────────────────────────────────────────────────────────────────
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#5C7170',
  display: 'block',
  marginBottom: 4,
};
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
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 14,
};

function btn(kind: 'primary' | 'ghost' | 'danger', disabled?: boolean): React.CSSProperties {
  const colors: Record<'primary' | 'ghost' | 'danger', { bg: string; color: string; border: string }> = {
    primary: { bg: TEAL, color: '#fff', border: 'none' },
    ghost: { bg: '#fff', color: '#5C7170', border: `1px solid ${BORDER}` },
    danger: { bg: '#fff', color: ERR, border: `1px solid ${BORDER}` },
  };
  const c = colors[kind];
  return {
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer',
    background: c.bg,
    color: c.color,
    border: c.border,
    opacity: disabled ? 0.6 : 1,
  };
}

// ─── types ──────────────────────────────────────────────────────────────────
type GstSlab = '0%' | '12%' | '18%';

type RoomType = {
  id: string;
  name: string;
  description: string | null;
  maxOccupancy: number;
  baseRate: string;
  floorRate: string;
  gstSlab: GstSlab;
  amenities: string[];
  stateVersion: number;
};

type FormState = {
  id: string; // '' = new
  name: string;
  description: string;
  maxOccupancy: string;
  baseRate: string;
  floorRate: string;
  gstSlab: GstSlab;
  amenities: string[];
  stateVersion: number;
};

const emptyForm: FormState = {
  id: '',
  name: '',
  description: '',
  maxOccupancy: '2',
  baseRate: '',
  floorRate: '',
  gstSlab: '12%',
  amenities: [],
  stateVersion: 0,
};

const PRESET_AMENITIES = [
  'Air conditioning',
  'Wi-Fi',
  'Mini bar',
  'Room service',
  'Bathtub',
  'Balcony',
  'Tea/coffee maker',
  'Safe',
];

const GST_SLABS: GstSlab[] = ['0%', '12%', '18%'];

const SLAB_PILL: Record<GstSlab, React.CSSProperties> = {
  '0%': { background: '#EEF2F2', color: '#5C7170' },
  '12%': { background: 'rgba(29,168,136,0.14)', color: '#0F7A5E' },
  '18%': { background: 'rgba(233,196,106,0.18)', color: '#6A4A0F' },
};

// ─── component ─────────────────────────────────────────────────────────────
export function RoomTypesClient({ initial }: { initial: RoomType[] }) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>(initial);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blockedDeleteId, setBlockedDeleteId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/room-types');
    if (!res.ok) return;
    const data = (await res.json()) as RoomType[];
    setRoomTypes(
      data.map((rt) => ({
        ...rt,
        baseRate: String(rt.baseRate),
        floorRate: String(rt.floorRate),
      })),
    );
  }

  function startNew() {
    setError('');
    setBlockedDeleteId(null);
    setForm({ ...emptyForm });
  }

  function startEdit(rt: RoomType) {
    setError('');
    setBlockedDeleteId(null);
    setForm({
      id: rt.id,
      name: rt.name,
      description: rt.description ?? '',
      maxOccupancy: String(rt.maxOccupancy),
      baseRate: rt.baseRate,
      floorRate: rt.floorRate,
      gstSlab: rt.gstSlab,
      amenities: [...rt.amenities],
      stateVersion: rt.stateVersion,
    });
  }

  function cancelForm() {
    setForm(null);
    setError('');
  }

  function toggleAmenity(name: string) {
    if (!form) return;
    setForm({
      ...form,
      amenities: form.amenities.includes(name)
        ? form.amenities.filter((a) => a !== name)
        : [...form.amenities, name],
    });
  }

  async function submitForm() {
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      // Build payload per roomTypeCreateSchema (no ceilingRate — see AC2).
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        maxOccupancy: Number(form.maxOccupancy),
        baseRate: Number(form.baseRate),
        floorRate: Number(form.floorRate),
        gstSlab: form.gstSlab,
        amenities: form.amenities,
      };
      if (form.description.trim()) payload.description = form.description.trim();

      const url = form.id ? `/api/room-types/${form.id}` : '/api/room-types';
      const method = form.id ? 'PUT' : 'POST';
      if (form.id) payload.stateVersion = form.stateVersion;

      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 && data.code === 'CONFLICT') {
          // Stale stateVersion — refetch and keep the form open so the Owner
          // can re-confirm against the latest values (AC5).
          await refresh();
          throw new Error('Someone else updated this room type. The list has been refreshed — please re-open Edit.');
        }
        throw new Error(data.message ?? 'Could not save room type');
      }
      await refresh();
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save room type');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError('');
    setBlockedDeleteId(null);
    try {
      const res = await fetch(`/api/room-types/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.code === 'ROOM_TYPE_HAS_ACTIVE_RESERVATIONS') {
          setBlockedDeleteId(id);
          throw new Error('Cannot delete — this room type has active reservations.');
        }
        throw new Error(data.message ?? 'Could not delete room type');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete room type');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      container="narrow"
      header={
        <PageHeader
          variant="minimal"
          eyebrow={[{ label: 'Settings', href: '/settings' }, { label: 'Room Types' }]}
          title="Room Types"
          subtitle={
            <>
              Configure the different types of rooms in your property. Add or remove{' '}
              <strong>Amenities</strong> for each room type for the whole set.
            </>
          }
        />
      }
    >
      <div style={cardStyle}>
        <div style={cardHeader}>
          <span>Room types</span>
          {!form ? (
            <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={startNew}>
              + Add room type
            </button>
          ) : null}
        </div>

        <div style={{ padding: 0 }}>
          {roomTypes.length === 0 && !form ? (
            <div style={{ padding: '24px 18px', fontSize: 13, color: MUTED }}>
              No room types yet — add your first one to get started.
            </div>
          ) : null}

          {roomTypes.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F4F9F8', color: '#5C7170', textAlign: 'left' }}>
                  <th style={{ padding: '10px 18px', fontWeight: 600 }}>Room type</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Max&nbsp;occ.</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Base rate</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Floor rate</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600 }}>GST</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, textAlign: 'right' }}>Amenities</th>
                  <th style={{ padding: '10px 18px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt) => (
                  <tr key={rt.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ fontWeight: 600, color: CHARCOAL }}>{rt.name}</div>
                      {rt.description ? (
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{rt.description}</div>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>{rt.maxOccupancy}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>₹{rt.baseRate}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>₹{rt.floorRate}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          ...SLAB_PILL[rt.gstSlab],
                        }}
                      >
                        {rt.gstSlab}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: MUTED }}>
                      {rt.amenities.length}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          style={btn('ghost', busy)}
                          disabled={busy}
                          onClick={() => startEdit(rt)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={btn('danger', busy)}
                          disabled={busy}
                          onClick={() => void remove(rt.id)}
                          title={
                            blockedDeleteId === rt.id
                              ? 'Has active reservations — 409 ROOM_TYPE_HAS_ACTIVE_RESERVATIONS'
                              : undefined
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {form ? (
            <div style={{ padding: '18px', background: '#F4F9F8', borderTop: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: CHARCOAL, marginBottom: 12 }}>
                {form.id ? 'Edit room type' : 'New room type'}
              </div>
              <div style={gridStyle}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Deluxe Garden Room"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Max occupancy</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={1}
                    max={50}
                    value={form.maxOccupancy}
                    onChange={(e) => setForm({ ...form, maxOccupancy: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Base rate (₹)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={1}
                    value={form.baseRate}
                    onChange={(e) => setForm({ ...form, baseRate: e.target.value })}
                    placeholder="baseRate"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Floor rate (₹)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={1}
                    value={form.floorRate}
                    onChange={(e) => setForm({ ...form, floorRate: e.target.value })}
                    placeholder="floorRate"
                  />
                </div>
                <div>
                  <label style={labelStyle}>GST slab</label>
                  <select
                    style={inputStyle}
                    value={form.gstSlab}
                    onChange={(e) => setForm({ ...form, gstSlab: e.target.value as GstSlab })}
                  >
                    {GST_SLABS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Description (optional)</label>
                  <input
                    style={inputStyle}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Short description shown on booking pages"
                  />
                </div>
              </div>

              {/* Amenities chip multi-select */}
              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Amenities</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PRESET_AMENITIES.map((a) => {
                    const on = form.amenities.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        style={{
                          padding: '5px 10px',
                          fontSize: 12,
                          fontWeight: 500,
                          borderRadius: 999,
                          border: `1px solid ${on ? TEAL : BORDER}`,
                          background: on ? 'rgba(29,168,136,0.12)' : '#fff',
                          color: on ? '#0F7A5E' : '#5C7170',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {on ? '✓ ' : ''}
                        {a}
                      </button>
                    );
                  })}
                  {form.amenities
                    .filter((a) => !PRESET_AMENITIES.includes(a))
                    .map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        style={{
                          padding: '5px 10px',
                          fontSize: 12,
                          fontWeight: 500,
                          borderRadius: 999,
                          border: `1px solid ${TEAL}`,
                          background: 'rgba(29,168,136,0.12)',
                          color: '#0F7A5E',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        ✓ {a} ×
                      </button>
                    ))}
                </div>
                <CustomAmenityInput
                  onAdd={(name) => {
                    if (!form.amenities.includes(name)) {
                      setForm({ ...form, amenities: [...form.amenities, name] });
                    }
                  }}
                />
                <div style={{ marginTop: 6, fontSize: 11.5, color: MUTED }}>
                  Multi-select · stored as a string array. Floor rate is the only rate bound — no ceiling.
                </div>
              </div>

              {error ? (
                <div style={{ marginTop: 12, color: ERR, fontSize: 12.5, fontWeight: 500 }}>{error}</div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={cancelForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  style={btn('primary', busy || !form.name.trim() || !form.baseRate || !form.floorRate)}
                  disabled={busy || !form.name.trim() || !form.baseRate || !form.floorRate}
                  onClick={() => void submitForm()}
                >
                  {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create room type'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {error && !form ? (
        <div style={{ marginTop: 12, color: ERR, fontSize: 12.5, fontWeight: 500 }}>{error}</div>
      ) : null}
    </PageShell>
  );
}

function CustomAmenityInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState('');
  function add() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  }
  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
      <input
        style={{ ...inputStyle, maxWidth: 240 }}
        value={value}
        placeholder="Add custom amenity"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
      />
      <button type="button" style={btn('ghost', !value.trim())} disabled={!value.trim()} onClick={add}>
        + Add
      </button>
    </div>
  );
}
