// @ts-nocheck
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

// Story 12.7d — Rooms screen client.
// One client component holding list + add/edit form + range-add mode + 409 UX.
// After every successful mutation we refetch from GET /api/rooms (no optimistic
// state) so the stateVersion bump handles itself.

type Room = {
  id: string;
  number: string;
  roomTypeId: string;
  floor: number | null;
  notes: string | null;
  accessible: boolean;
  connectingRoomId: string | null;
  stateVersion: number;
};
type RoomType = { id: string; name: string };

const TEAL = '#1DA888';
const CHARCOAL = '#1A2B2E';
const MUTED = '#9EAEAC';
const BORDER = '#E8EFEE';
const SOFT = '#F4F9F8';

type Mode = 'single' | 'range';
type FormState = {
  id: string | null; // null = create
  number: string;
  roomTypeId: string;
  floor: string; // string for input binding
  notes: string;
  accessible: boolean;
  connectingRoomId: string;
  stateVersion: number;
  // range-only
  rangeStart: string;
  rangeEnd: string;
  rangePrefix: string;
};

function emptyForm(roomTypes: RoomType[]): FormState {
  return {
    id: null,
    number: '',
    roomTypeId: roomTypes[0]?.id ?? '',
    floor: '',
    notes: '',
    accessible: false,
    connectingRoomId: '',
    stateVersion: 0,
    rangeStart: '',
    rangeEnd: '',
    rangePrefix: '',
  };
}

function floorLabel(floor: number | null) {
  if (floor === null || floor === undefined) return 'Unassigned';
  if (floor === 0) return 'Ground floor';
  return `Floor ${floor}`;
}

export function RoomsClient({
  initialRooms,
  roomTypes,
}: {
  initialRooms: Room[];
  roomTypes: RoomType[];
}) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [mode, setMode] = useState<Mode>('single');
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<string | null>(null);

  const hasRoomTypes = roomTypes.length > 0;

  const grouped = useMemo(() => {
    const map = new Map<string, Room[]>();
    for (const r of rooms) {
      const key = r.floor === null ? 'null' : String(r.floor);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .map(([k, list]) => ({
        floor: k === 'null' ? null : Number(k),
        rooms: list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
      }))
      .sort((a, b) => {
        if (a.floor === null) return 1;
        if (b.floor === null) return -1;
        return a.floor - b.floor;
      });
  }, [rooms]);

  const summary = useMemo(() => {
    const floors = new Set(rooms.filter((r) => r.floor !== null).map((r) => r.floor));
    const types = new Set(rooms.map((r) => r.roomTypeId));
    const flagged = rooms.filter((r) => r.accessible || r.connectingRoomId).length;
    return { rooms: rooms.length, floors: floors.size, types: types.size, flagged };
  }, [rooms]);

  async function refetch() {
    const res = await fetch('/api/rooms', { cache: 'no-store' });
    if (res.ok) setRooms(await res.json());
  }

  function openAdd() {
    setError(null);
    setInfo(null);
    setMode('single');
    setForm(emptyForm(roomTypes));
  }

  function openEdit(r: Room) {
    setError(null);
    setInfo(null);
    setMode('single');
    setForm({
      id: r.id,
      number: r.number,
      roomTypeId: r.roomTypeId,
      floor: r.floor === null ? '' : String(r.floor),
      notes: r.notes ?? '',
      accessible: r.accessible,
      connectingRoomId: r.connectingRoomId ?? '',
      stateVersion: r.stateVersion,
      rangeStart: '',
      rangeEnd: '',
      rangePrefix: '',
    });
  }

  async function submit() {
    if (!form) return;
    setBusy(true);
    setError(null);

    try {
      if (mode === 'range' && !form.id) {
        const start = Number(form.rangeStart);
        const end = Number(form.rangeEnd);
        if (!Number.isInteger(start) || !Number.isInteger(end)) {
          setError('Range start and end must be whole numbers.');
          return;
        }
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start,
            end,
            prefix: form.rangePrefix || undefined,
            roomTypeId: form.roomTypeId,
            floor: form.floor === '' ? undefined : Number(form.floor),
            accessible: form.accessible,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.message ?? 'Failed to create rooms.');
          return;
        }
        const { created, skipped } = await res.json();
        await refetch();
        setForm(null);
        if (skipped?.length) {
          setInfo(`Added ${created.length}; skipped ${skipped.length} existing: ${skipped.join(', ')}.`);
        } else {
          setInfo(`Added ${created.length} rooms.`);
        }
        return;
      }

      const payload: any = {
        number: form.number.trim(),
        roomTypeId: form.roomTypeId,
        floor: form.floor === '' ? undefined : Number(form.floor),
        notes: form.notes.trim() || undefined,
        accessible: form.accessible,
        connectingRoomId: form.connectingRoomId || null,
      };

      const url = form.id ? `/api/rooms/${form.id}` : '/api/rooms';
      const method = form.id ? 'PUT' : 'POST';
      if (form.id) payload.stateVersion = form.stateVersion;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 409 && form.id) {
        // Stale stateVersion (AC concurrency).
        await refetch();
        setForm(null);
        setError('Someone else updated this room. The list has been refreshed — please re-open Edit.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Save failed.');
        return;
      }

      await refetch();
      setForm(null);
      setInfo(form.id ? 'Room updated.' : 'Room added.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: Room) {
    setError(null);
    setInfo(null);
    setBlockedDelete(null);
    if (!confirm(`Delete room ${r.number}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${r.id}`, { method: 'DELETE' });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'ROOM_HAS_ACTIVE_RESERVATIONS') {
          setBlockedDelete(r.id);
          return;
        }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Delete failed.');
        return;
      }
      await refetch();
      setInfo(`Room ${r.number} deleted.`);
    } finally {
      setBusy(false);
    }
  }

  const typeName = (id: string) => roomTypes.find((rt) => rt.id === id)?.name ?? '—';

  return (
    <div style={{ padding: '28px 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, color: MUTED }}>Settings › <span style={{ color: TEAL }}>Rooms</span></div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: CHARCOAL, marginTop: 4 }}>Rooms</h1>
        <p style={{ fontSize: 13, color: '#5C7170', marginTop: 6, maxWidth: 640 }}>
          Configure your physical room units. Each room belongs to a room type and a floor. Use{' '}
          <strong>Add range</strong> to create a block of rooms in one action.
        </p>
      </div>

      {!hasRoomTypes && (
        <div
          style={{
            background: '#FFF8E6',
            border: '1px dashed #E9C46A',
            color: '#6A4A0F',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          You need at least one <strong>room type</strong> before adding rooms.{' '}
          <Link href="/settings/room-types" style={{ color: TEAL, fontWeight: 600 }}>
            Go to Room Types →
          </Link>
        </div>
      )}

      {error && (
        <div style={{ background: '#F7DCD0', color: '#B5572A', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}
      {info && (
        <div style={{ background: '#D6F2EA', color: '#0F7A5E', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
          {info}
        </div>
      )}

      <div style={{ display: 'flex', gap: 14 }}>
        {[
          ['Rooms configured', summary.rooms],
          ['Floors', summary.floors],
          ['Room types in use', summary.types],
          ['Flagged rooms', summary.flagged],
        ].map(([lbl, val]) => (
          <div
            key={String(lbl)}
            style={{ flex: 1, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: CHARCOAL }}>{val}</div>
            <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(26,43,46,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>Rooms</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              {summary.rooms} rooms across {summary.floors} floor{summary.floors === 1 ? '' : 's'} · grouped by floor
            </div>
          </div>
          <button
            type="button"
            onClick={openAdd}
            disabled={!hasRoomTypes || busy}
            style={{
              padding: '7px 14px',
              background: hasRoomTypes ? TEAL : '#C5D0CF',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: hasRoomTypes ? 'pointer' : 'not-allowed',
            }}
          >
            + Add room
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAFCFC' }}>
              <th style={th(20)}>Room</th>
              <th style={th(30)}>Room type</th>
              <th style={th(12)}>Floor</th>
              <th style={th(22)}>Flags</th>
              <th style={{ ...th(16), textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: MUTED, fontSize: 13 }}>
                  No rooms yet. Click <strong>+ Add room</strong> to create your first unit.
                </td>
              </tr>
            )}
            {grouped.map((group) => (
              <Group key={String(group.floor)} group={group} rooms={rooms}>
                {group.rooms.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: CHARCOAL }}>{r.number}</div>
                      {r.notes && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{r.notes}</div>}
                    </td>
                    <td style={td}>{typeName(r.roomTypeId)}</td>
                    <td style={td}>{floorLabel(r.floor)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {r.accessible && <Pill color="blue">Accessible</Pill>}
                        {r.connectingRoomId && (
                          <Pill color="amber">
                            Connecting → {rooms.find((x) => x.id === r.connectingRoomId)?.number ?? '?'}
                          </Pill>
                        )}
                        {!r.accessible && !r.connectingRoomId && <span style={{ color: '#C5D0CF', fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => openEdit(r)} disabled={busy} style={iconBtn()}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(r)}
                          disabled={busy}
                          style={iconBtn(true)}
                          title={
                            blockedDelete === r.id
                              ? 'Cannot delete — room has active reservations.'
                              : undefined
                          }
                        >
                          Delete
                        </button>
                      </div>
                      {blockedDelete === r.id && (
                        <div style={{ fontSize: 11, color: '#B5572A', marginTop: 4 }}>
                          Blocked — active reservations.
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </Group>
            ))}
          </tbody>
        </table>

        {form && (
          <div
            style={{
              margin: '0 20px 20px',
              border: `1px dashed ${TEAL}`,
              borderRadius: 10,
              background: SOFT,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F7A5E', marginBottom: 14 }}>
              {form.id ? '✎ Edit room' : '✎ Add room'}
            </div>

            {!form.id && (
              <div
                style={{
                  display: 'inline-flex',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#fff',
                  marginBottom: 14,
                }}
              >
                {(['single', 'range'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    style={{
                      padding: '7px 16px',
                      border: 'none',
                      background: mode === m ? TEAL : '#fff',
                      color: mode === m ? '#fff' : '#5C7170',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {m === 'single' ? 'Single room' : 'Add range'}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 20px' }}>
              {mode === 'single' || form.id ? (
                <Field label="Room number / name">
                  <input
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    placeholder="e.g. 106"
                    style={input}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Start number">
                    <input
                      value={form.rangeStart}
                      onChange={(e) => setForm({ ...form, rangeStart: e.target.value })}
                      placeholder="101"
                      style={input}
                    />
                  </Field>
                  <Field label="End number">
                    <input
                      value={form.rangeEnd}
                      onChange={(e) => setForm({ ...form, rangeEnd: e.target.value })}
                      placeholder="110"
                      style={input}
                    />
                  </Field>
                  <Field label="Prefix (optional)">
                    <input
                      value={form.rangePrefix}
                      onChange={(e) => setForm({ ...form, rangePrefix: e.target.value })}
                      placeholder="e.g. G-"
                      style={input}
                    />
                  </Field>
                </>
              )}

              <Field label="Room type">
                <select
                  value={form.roomTypeId}
                  onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
                  style={input}
                >
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Floor">
                <input
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  placeholder="0 (Ground), 1, 2..."
                  style={input}
                />
              </Field>
            </div>

            {(mode === 'single' || form.id) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
                  <label style={checkboxRow}>
                    <input
                      type="checkbox"
                      checked={form.accessible}
                      onChange={(e) => setForm({ ...form, accessible: e.target.checked })}
                    />
                    Accessible room
                  </label>
                  <label style={checkboxRow}>
                    Connecting →
                    <select
                      value={form.connectingRoomId}
                      onChange={(e) => setForm({ ...form, connectingRoomId: e.target.value })}
                      style={{ ...input, padding: '6px 10px' }}
                    >
                      <option value="">(none)</option>
                      {rooms.filter((r) => r.id !== form.id).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.number}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Field label="Notes (optional)">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Internal note — e.g. balcony over the lake"
                    style={{ ...input, minHeight: 56, resize: 'vertical' }}
                  />
                </Field>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setForm(null)} disabled={busy} style={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={() => void submit()} disabled={busy} style={btnPrimary}>
                {form.id ? 'Save room' : mode === 'range' ? 'Add range' : 'Save room'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ group, children }: { group: { floor: number | null; rooms: Room[] }; rooms: Room[]; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td
          colSpan={5}
          style={{
            background: '#FAFCFC',
            padding: '8px 20px',
            fontSize: 11,
            fontWeight: 700,
            color: '#5C7170',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          {floorLabel(group.floor)} — {group.rooms.length} room{group.rooms.length === 1 ? '' : 's'}
        </td>
      </tr>
      {children}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</label>
      {children}
    </div>
  );
}

function Pill({ color, children }: { color: 'blue' | 'amber'; children: React.ReactNode }) {
  const map = {
    blue: { bg: '#DCE9F2', fg: '#3A6FA0' },
    amber: { bg: '#FBF1D5', fg: '#B5853A' },
  } as const;
  const c = map[color];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {children}
    </span>
  );
}

const th = (pct: number): React.CSSProperties => ({
  width: `${pct}%`,
  textAlign: 'left',
  padding: '10px 20px',
  fontSize: 11,
  fontWeight: 600,
  color: MUTED,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  borderBottom: `1px solid ${BORDER}`,
});

const td: React.CSSProperties = {
  padding: '13px 20px',
  borderBottom: '1px solid #F0F4F4',
  verticalAlign: 'middle',
};

const input: React.CSSProperties = {
  padding: '9px 12px',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: 13,
  color: CHARCOAL,
  background: '#fff',
};

const checkboxRow: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12.5,
  color: '#5C7170',
};

const iconBtn = (danger = false): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: `1px solid ${danger ? '#F4D5C7' : BORDER}`,
  background: '#fff',
  color: danger ? '#B5572A' : CHARCOAL,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
});

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: TEAL,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: '#5C7170',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
