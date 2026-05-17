// @ts-nocheck
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EvidenceCapture } from './evidence-capture';

const cleanGroups = [
  ['Bedroom', ['Strip used linen', 'Make bed with fresh linen', 'Dust surfaces', 'Empty trash', 'Vacuum/sweep floor']],
  ['Bathroom', ['Clean toilet', 'Clean sink + mirror', 'Clean shower/tub', 'Replace bath mat if soiled', 'Mop floor']],
  ['Final check', ['Reset AC to default', 'Test lights + remote', 'Visual sweep complete']],
];

const defaultEvidence = { note: '', voiceState: 'idle' as const };

function syncHeaders() {
  return { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() };
}

export function CleanTaskClient({ room, photoRequired = false }: { room: any; photoRequired?: boolean }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState(defaultEvidence);
  const total = cleanGroups.reduce((sum, [, items]) => sum + items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;
  const enabled = done === total && (!photoRequired || Boolean(evidence.photoName));

  async function submit() {
    const res = await fetch(`/api/rooms/${room.id}/housekeeping-status`, {
      method: 'PATCH',
      headers: syncHeaders(),
      body: JSON.stringify({ toState: 'CLEAN', stateVersion: room.stateVersion, evidence }),
    });
    if (res.status === 409) location.reload();
    if (res.ok) location.href = `/room/${room.id}`;
  }

  return (
    <TaskFrame title={`Clean ${room.number}`} disabled={!enabled} disabledReason={done < total ? `${done}/${total} complete` : 'Photo required to complete.'} onSubmit={submit} cta="Mark Clean Done">
      {cleanGroups.map(([group, items]) => (
        <section key={group} className="hk-card" style={{ padding: 14, marginBottom: 12 }}>
          <strong>{group} · {items.filter((item) => checked[item]).length}/{items.length}</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {items.map((item) => (
              <label key={item} style={{ minHeight: 52, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={Boolean(checked[item])} onChange={(event) => setChecked({ ...checked, [item]: event.target.checked })} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>
      ))}
      <EvidenceCapture value={evidence} onChange={setEvidence} photoRequired={photoRequired} />
    </TaskFrame>
  );
}

export function RefillTaskClient({ room, items }: { room: any; items: any[] }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState(defaultEvidence);
  const acted = Object.entries(qty).filter(([, value]) => value >= 0);

  async function submit() {
    const payload = {
      roomId: room.id,
      items: acted.map(([catalogItemId, value]) => ({ catalogItemId, qtyAddedToReachPar: value })),
      evidence,
    };
    const res = await fetch('/api/consumption-logs', { method: 'POST', headers: syncHeaders(), body: JSON.stringify(payload) });
    if (res.ok) location.href = `/room/${room.id}`;
  }

  return (
    <TaskFrame title={`Refill ${room.number}`} disabled={acted.length === 0} disabledReason="Top up at least one row" onSubmit={submit} cta="Submit Refill">
      {items.map((item) => {
        const band = (item.totalOwned ?? 0) <= 0 ? 'Out' : (item.totalOwned ?? 0) <= 3 ? 'Low' : 'Healthy';
        return (
          <section key={item.id} className="hk-card" style={{ padding: 14, marginBottom: 10, background: band === 'Out' ? '#FFF7ED' : 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <strong>{item.name}</strong>
              <span style={{ color: '#66736F', fontSize: 12 }}>Par {item.expectedQtyPerStay}</span>
            </div>
            <p style={{ margin: '8px 0', color: band === 'Healthy' ? '#127C69' : '#B7791F', fontSize: 12, fontWeight: 900 }}>{band}</p>
            <Stepper value={qty[item.id] ?? 0} max={item.expectedQtyPerStay ?? 0} onChange={(value) => setQty({ ...qty, [item.id]: value })} />
            {band !== 'Healthy' ? (
              <label style={{ display: 'flex', minHeight: 44, alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={Boolean(override[item.id])} onChange={(event) => setOverride({ ...override, [item.id]: event.target.checked })} />
                Storage actually has stock
              </label>
            ) : null}
          </section>
        );
      })}
      <EvidenceCapture value={evidence} onChange={setEvidence} />
    </TaskFrame>
  );
}

export function LinenTaskClient({ room, items, category, ownerOpenLog }: { room: any; items: any[]; category: 'ROUTINE' | 'PERIODIC'; ownerOpenLog?: any }) {
  const [dirty, setDirty] = useState<Record<string, number>>(() => Object.fromEntries(items.map((item) => [item.id, item.standardQty ?? 1])));
  const [clean, setClean] = useState<Record<string, number>>(() => Object.fromEntries(items.map((item) => [item.id, item.standardQty ?? 1])));
  const [evidence, setEvidence] = useState(defaultEvidence);

  async function submit() {
    const payload = {
      roomId: room.id,
      linenCategory: category,
      items: items.map((item) => ({ catalogItemId: item.id, dirtyPulled: dirty[item.id] ?? 0, cleanPlaced: clean[item.id] ?? 0 })),
      evidence,
    };
    const res = await fetch('/api/laundry-logs', { method: 'POST', headers: syncHeaders(), body: JSON.stringify(payload) });
    if (res.ok) location.href = `/room/${room.id}`;
  }

  return (
    <TaskFrame title={category === 'ROUTINE' ? `Linen Swap ${room.number}` : `Periodic Linen ${room.number}`} disabled={items.length === 0} disabledReason="No linen rows" onSubmit={submit} cta={ownerOpenLog ? 'Add to existing log' : 'Submit Linen'}>
      {ownerOpenLog && category === 'ROUTINE' ? <section className="hk-card" style={{ padding: 12, marginBottom: 12, color: '#B7791F' }}>Owner already started this log. You are adding items.</section> : null}
      {category === 'PERIODIC' ? <section className="hk-card" style={{ padding: 12, marginBottom: 12 }}>Cadence task · last completion shown when available</section> : null}
      {items.map((item) => {
        const stockEmpty = (item.totalOwned ?? 0) <= 0;
        const standard = item.standardQty ?? 1;
        const missing = (dirty[item.id] ?? 0) < standard;
        return (
          <section key={item.id} className="hk-card" style={{ padding: 14, marginBottom: 10, background: stockEmpty ? '#FFF7ED' : 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{item.name}</strong>
              <span style={{ fontSize: 11, fontWeight: 900, color: category === 'PERIODIC' ? '#6B21A8' : '#127C69' }}>{category}</span>
            </div>
            {stockEmpty ? <p style={{ color: '#B7791F', fontSize: 12, fontWeight: 900 }}>Clean stock empty — flagged for owner</p> : null}
            <p style={{ color: '#66736F', fontSize: 12 }}>Standard {standard}</p>
            <Stepper label="Dirty pulled" value={dirty[item.id] ?? standard} max={standard + 3} onChange={(value) => setDirty({ ...dirty, [item.id]: value })} />
            <Stepper label="Clean placed" value={clean[item.id] ?? standard} max={stockEmpty ? 0 : standard + 3} onChange={(value) => setClean({ ...clean, [item.id]: value })} />
            {missing ? <Link href={`/issue?entryContext=MISSING_FROM_ROOM&roomId=${room.id}&catalogItemId=${item.id}&qtyShort=${standard - (dirty[item.id] ?? 0)}`} style={{ color: '#B7791F', fontSize: 13, fontWeight: 900 }}>Report missing item</Link> : null}
          </section>
        );
      })}
      <EvidenceCapture value={evidence} onChange={setEvidence} />
    </TaskFrame>
  );
}

export function LaundryReceiveClient({ snapshot }: { snapshot: any }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const rows = snapshot.items ?? [];

  async function submit() {
    const payload = { items: rows.map((item) => ({ catalogItemId: item.catalogItemId, receivedQty: qty[item.catalogItemId] ?? 0 })) };
    const res = await fetch('/api/laundry-logs/receive', { method: 'POST', headers: syncHeaders(), body: JSON.stringify(payload) });
    if (res.ok) location.href = '/laundry-in';
  }

  return (
    <TaskFrame title="Laundry Receive" disabled={rows.length === 0} disabledReason="No open outgoing laundry" onSubmit={submit} cta="Receive Laundry" nav>
      <section className="hk-card" style={{ padding: 14, marginBottom: 12 }}>
        <strong>{snapshot.vendorName}</strong>
        <p style={{ margin: '6px 0 0', color: '#66736F', fontSize: 13 }}>{snapshot.openCycleCount} open cycles</p>
      </section>
      {rows.map((item) => {
        const received = qty[item.catalogItemId] ?? 0;
        return (
          <section key={item.catalogItemId} className="hk-card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{item.name}</strong>
              <span style={{ fontSize: 11, fontWeight: 900 }}>{item.linenCategory}</span>
            </div>
            <p style={{ color: '#66736F', fontSize: 12 }}>Expected back {item.expectedBack}</p>
            <Stepper label="Received" value={received} max={item.expectedBack + 3} onChange={(value) => setQty({ ...qty, [item.catalogItemId]: value })} />
            {received > item.expectedBack ? <p style={{ color: '#B7791F', fontSize: 12, fontWeight: 900 }}>+{received - item.expectedBack} over expected — confirm?</p> : null}
            <Link href={`/issue?entryContext=DAMAGED_ON_RETURN&catalogItemId=${item.catalogItemId}&qty=1&vendorName=${encodeURIComponent(snapshot.vendorName)}`} style={{ color: '#6B21A8', fontSize: 13, fontWeight: 900 }}>Report damaged return</Link>
          </section>
        );
      })}
    </TaskFrame>
  );
}

function Stepper({ value, max, onChange, label = 'Top up to par' }: { value: number; max: number; onChange: (value: number) => void; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '10px 0' }}>
      <span style={{ fontSize: 13, color: '#66736F' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="hk-button" type="button" style={{ width: 44 }} onClick={() => onChange(Math.max(0, value - 1))}>-</button>
        <strong style={{ minWidth: 24, textAlign: 'center' }}>{value}</strong>
        <button className="hk-button" type="button" style={{ width: 44 }} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

function TaskFrame({ title, children, disabled, disabledReason, onSubmit, cta, nav = false }: any) {
  return (
    <main className="hk-screen" style={{ paddingBottom: 110 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Link href=".." style={{ minHeight: 44, display: 'grid', placeItems: 'center', color: '#1DA888', fontWeight: 900 }}>Back</Link>
        <h1 style={{ margin: 0, fontSize: 20 }}>{title}</h1>
        <span style={{ fontSize: 12, color: '#127C69', fontWeight: 900 }}>Synced</span>
      </header>
      {children}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: nav ? 70 : 0, maxWidth: 430, margin: '0 auto', padding: 12, background: 'rgba(255,255,255,0.96)', borderTop: '1px solid #DBE7E4' }}>
        <button className="hk-button" type="button" disabled={disabled} onClick={onSubmit} style={{ width: '100%', background: disabled ? '#CBD5D1' : '#1DA888' }}>
          {disabled ? disabledReason : cta}
        </button>
      </div>
    </main>
  );
}
