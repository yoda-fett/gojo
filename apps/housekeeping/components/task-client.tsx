// @ts-nocheck
'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Package, Shirt } from 'lucide-react';

import { EvidenceCapture } from './evidence-capture';
import { PwaShell } from './pwa-shell';

const cleanGroups = [
  ['Bedroom', ['Strip used linen', 'Make bed with fresh linen', 'Dust surfaces', 'Empty trash', 'Vacuum/sweep floor']],
  ['Bathroom', ['Clean toilet', 'Clean sink + mirror', 'Clean shower/tub', 'Replace bath mat if soiled', 'Mop floor']],
  ['Final check', ['Reset AC to default', 'Test lights + remote', 'Visual sweep complete']],
];

const defaultEvidence = { note: '', voiceState: 'idle' as const };

function syncHeaders() {
  return { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() };
}

export function CleanTaskClient({ room, roomTypeName, photoRequired = false }: { room: any; roomTypeName?: string; photoRequired?: boolean }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState(defaultEvidence);
  const total = cleanGroups.reduce((sum, [, items]) => sum + items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;
  const enabled = done === total && (!photoRequired || Boolean(evidence.photoName));
  // Honest copy on the ready-state: until per-task state lands (Epic 15 ext.),
  // tapping this button flips the *room* to CLEAN, not just the CLEAN task.
  // Staff need to know that. See _bmad-output/implementation-artifacts/
  // epic-15-extension-per-task-state.md.
  const helperText = done < total
    ? 'Complete all items first'
    : photoRequired && !evidence.photoName
      ? 'Add a photo to continue'
      : 'Looks good — this marks the room ready for guests';
  const helperTone: 'ok' | 'warn' | undefined = enabled ? 'ok' : undefined;

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
    <TaskFrame
      title={`Room ${room.number}`}
      eyebrow="Cleaning"
      subtitle={roomTypeName}
      back={`/room/${room.id}`}
      progress={{ done, total, label: 'Steps complete' }}
      disabled={!enabled}
      helperText={helperText}
      helperTone={helperTone}
      onSubmit={submit}
      cta="Mark Clean Done"
    >
      {cleanGroups.map(([group, items]) => {
        const sectionDone = items.filter((item) => checked[item]).length;
        const complete = sectionDone === items.length;
        return (
          <section key={group} style={{ marginBottom: 14 }}>
            <div className="hk-section-head">
              <span>{group}</span>
              <span className={complete ? 'count complete' : 'count'}>
                {sectionDone} / {items.length}
              </span>
            </div>
            <div className="hk-check-list">
              {items.map((item) => {
                const isDone = Boolean(checked[item]);
                return (
                  <div
                    key={item}
                    className={isDone ? 'hk-check-row done' : 'hk-check-row'}
                    role="button"
                    tabIndex={0}
                    onClick={() => setChecked({ ...checked, [item]: !isDone })}
                    onKeyDown={(event) => {
                      if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault();
                        setChecked({ ...checked, [item]: !isDone });
                      }
                    }}
                  >
                    <span className="hk-checkbox" aria-hidden>{isDone ? '✓' : ''}</span>
                    <span className="hk-check-label">{item}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <EvidenceCapture value={evidence} onChange={setEvidence} photoRequired={photoRequired} />
    </TaskFrame>
  );
}

export function RefillTaskClient({ room, roomTypeName, items }: { room: any; roomTypeName?: string; items: any[] }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [evidence, setEvidence] = useState(defaultEvidence);

  const acted = Object.entries(qty).filter(([, value]) => value > 0);
  const total = items.length;
  const done = items.filter((item) => (qty[item.id] ?? 0) >= (item.expectedQtyPerStay ?? 0)).length;

  // Helper-line buckets per Owner spec — staff actions on the rows:
  //   topped-up = staff added at least one unit, OR no action needed (assumed at par)
  //   flagged   = stock OOS and not overridden (will be queued)
  //   untouched = staff has not interacted; defaults to "assumed at par"
  let toppedUp = 0;
  let flagged = 0;
  let untouched = 0;
  for (const item of items) {
    const stockEmpty = (item.totalOwned ?? 0) <= 0;
    const overridden = Boolean(override[item.id]);
    const count = qty[item.id] ?? 0;
    if (stockEmpty && !overridden) flagged += 1;
    else if (count > 0) toppedUp += 1;
    else untouched += 1;
  }
  const helperText = `${toppedUp} topped up · ${flagged} flagged · ${untouched} untouched (assumed at par)`;

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
    <TaskFrame
      title={`Room ${room.number}`}
      eyebrow="Refill"
      subtitle={roomTypeName}
      back={`/room/${room.id}`}
      progress={{ done, total, label: 'Items reviewed' }}
      disabled={acted.length === 0}
      helperText={helperText}
      helperTone={flagged > 0 ? 'warn' : toppedUp > 0 ? 'ok' : undefined}
      onSubmit={submit}
      cta="Mark Refill Done"
    >
      <div className="hk-refill-list">
        {items.map((item) => {
          const par = item.expectedQtyPerStay ?? 0;
          const stock = item.totalOwned ?? 0;
          const band: 'healthy' | 'low' | 'out' = stock <= 0 ? 'out' : stock <= 3 ? 'low' : 'healthy';
          const count = qty[item.id] ?? 0;
          const overridden = Boolean(override[item.id]);
          const oos = band === 'out' && !overridden;

          const canDec = count > 0 && !oos;
          const canInc = count < par && !oos;
          const hint = stepperHint(count, par, oos);

          return (
            <div key={item.id} className={oos ? 'hk-refill-row oos' : 'hk-refill-row'}>
              <span className="hk-item-ico" aria-hidden>
                <Package size={18} />
              </span>
              <div className="hk-item-body">
                <div className="hk-item-name">{item.name}</div>
                <div className="hk-item-meta-row">
                  <span className="hk-par-badge">Par: {par}</span>
                  <span className={`hk-stock-badge${band === 'low' ? ' low' : band === 'out' ? ' out' : ''}`}>
                    {band === 'out' ? 'Out of stock' : band === 'low' ? `Low — ${stock} in storage` : `${stock} in storage`}
                  </span>
                </div>
                {band !== 'healthy' ? (
                  <>
                    {oos ? <div className="hk-oos-msg">⚠ Storage empty — flagged for owner. Skip this item.</div> : null}
                    <button
                      type="button"
                      className={overridden ? 'hk-override-link active' : 'hk-override-link'}
                      onClick={() => setOverride({ ...override, [item.id]: !overridden })}
                    >
                      {overridden ? 'Override on — using room stock' : 'Storage actually has stock — override'}
                    </button>
                  </>
                ) : null}
              </div>
              <div className="hk-stepper-stack">
                <span className="hk-stepper-label">Topped up</span>
                <div className="hk-stepper">
                  <button
                    type="button"
                    className="hk-step-btn"
                    disabled={!canDec}
                    onClick={() => setQty({ ...qty, [item.id]: Math.max(0, count - 1) })}
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="hk-step-count">
                    {count}
                    <span className="of"> / {par}</span>
                  </span>
                  <button
                    type="button"
                    className="hk-step-btn"
                    disabled={!canInc}
                    onClick={() => setQty({ ...qty, [item.id]: Math.min(par, count + 1) })}
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
                <span className="hk-stepper-hint">{hint}</span>
              </div>
            </div>
          );
        })}
      </div>
      <EvidenceCapture value={evidence} onChange={setEvidence} />
    </TaskFrame>
  );
}

function formatIstDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

function stepperHint(count: number, par: number, oos: boolean): string {
  if (oos) return 'Skip — owner notified';
  if (count === 0) return 'Tap + when below par';
  if (count < par) return `Added ${count} — ${par - count} still in room`;
  return 'Topped up to par';
}

export function LinenTaskClient({
  room,
  roomTypeName,
  items,
  category,
  ownerOpenLog,
  periodicContext,
}: {
  room: any;
  roomTypeName?: string;
  items: any[];
  category: 'ROUTINE' | 'PERIODIC';
  ownerOpenLog?: any;
  // Periodic-only metadata for the context strip (wireframe 07).
  // `lastDoneIso` null → "Never — first time".
  periodicContext?: { cadenceLabel: string; lastDoneIso: string | null };
}) {
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

  const done = items.filter((item) => {
    const std = item.standardQty ?? 1;
    const stockEmpty = (item.totalOwned ?? 0) <= 0;
    const d = dirty[item.id] ?? std;
    const c = clean[item.id] ?? std;
    // Counts as done when dirty pulled meets standard AND clean placed meets
    // standard (or storage is empty — staff can't place what isn't there).
    return d >= std && (stockEmpty || c >= std);
  }).length;

  // Helper-line buckets — sum of missing units (dirty pulled below standard)
  // and count of OOS rows flagged out-of-stock.
  let missingUnits = 0;
  let oosFlagged = 0;
  for (const item of items) {
    const std = item.standardQty ?? 1;
    const stockEmpty = (item.totalOwned ?? 0) <= 0;
    const d = dirty[item.id] ?? std;
    if (d < std) missingUnits += std - d;
    if (stockEmpty) oosFlagged += 1;
  }
  const helperText =
    missingUnits > 0
      ? `${missingUnits} item${missingUnits === 1 ? '' : 's'} missing — will be queued as a loss report.`
      : `All ${items.length} items recorded${oosFlagged > 0 ? ` · ${oosFlagged} flagged out-of-stock` : ''}.`;
  const helperTone: 'ok' | 'warn' | undefined =
    missingUnits > 0 || oosFlagged > 0 ? 'warn' : items.length > 0 ? 'ok' : undefined;

  return (
      <TaskFrame
        title={category === 'ROUTINE' ? `Room ${room.number}` : 'Periodic Linen'}
        eyebrow={category === 'ROUTINE' ? 'Linen Swap' : '✦ Periodic Task'}
        subtitle={category === 'ROUTINE' ? roomTypeName : roomTypeName ? `Room ${room.number} — ${roomTypeName}` : `Room ${room.number}`}
        back={`/room/${room.id}`}
        headerVariant={category === 'PERIODIC' ? 'periodic' : undefined}
        progress={{ done, total: items.length, label: 'Items recorded' }}
        disabled={items.length === 0}
        helperText={helperText}
        helperTone={helperTone}
        onSubmit={submit}
        cta={category === 'ROUTINE' ? 'Mark Linen Swap Done' : 'Mark Periodic Done'}
      >
        {ownerOpenLog && category === 'ROUTINE' ? (
          <div className="hk-owner-banner">
            <span className="ob-ico">!</span>
            <div className="ob-text">Owner already started this log. You are adding items.</div>
          </div>
        ) : null}
        {category === 'PERIODIC' && periodicContext ? (
          <div className="hk-context-strip">
            <div className="hk-context-row-1">
              <span className="hk-cadence-chip">⏱ {periodicContext.cadenceLabel}</span>
              {periodicContext.lastDoneIso ? (
                <span className="hk-last-done">Last done: {formatIstDate(periodicContext.lastDoneIso)}</span>
              ) : (
                <span className="hk-last-done never">Never — first time</span>
              )}
            </div>
            <div className="hk-context-caption">
              Cadence task — runs on schedule. Take dirty linens off, send to laundry, and re-hang clean ones.
            </div>
          </div>
        ) : null}

        <div className="hk-linen-list">
          {items.map((item) => {
            const stockEmpty = (item.totalOwned ?? 0) <= 0;
            const stock = item.totalOwned ?? 0;
            const std = item.standardQty ?? 1;
            const d = dirty[item.id] ?? std;
            const c = clean[item.id] ?? std;
            const dirtyMissing = std - d;
            const cleanShort = std - c;
            const cleanBand: 'healthy' | 'low' | 'out' = stockEmpty ? 'out' : stock <= 3 ? 'low' : 'healthy';

            return (
              <div key={item.id} className={stockEmpty ? 'hk-linen-row oos' : 'hk-linen-row'}>
                <div className="hk-linen-row-top">
                  <span className="hk-item-ico" aria-hidden>
                    <Shirt size={18} />
                  </span>
                  <div className="hk-item-body">
                    <div className="hk-item-name">{item.name}</div>
                    <div className="hk-item-meta-row">
                      <span className="hk-par-badge">Standard: {std}</span>
                      <span className={`hk-stock-badge${cleanBand === 'low' ? ' low' : cleanBand === 'out' ? ' out' : ''}`}>
                        {cleanBand === 'out'
                          ? 'Out of stock'
                          : cleanBand === 'low'
                            ? `Low — ${stock} clean in storage`
                            : `${stock} clean in storage`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hk-dual-counter">
                  <CounterBlock
                    variant="dirty"
                    label="Dirty pulled"
                    value={d}
                    max={std + 3}
                    onChange={(v) => setDirty({ ...dirty, [item.id]: v })}
                    standard={std}
                  />
                  <CounterBlock
                    variant={stockEmpty ? 'disabled' : 'clean'}
                    label="Clean placed"
                    value={stockEmpty ? 0 : c}
                    max={stockEmpty ? 0 : std + 3}
                    onChange={(v) => setClean({ ...clean, [item.id]: v })}
                    standard={std}
                    disabled={stockEmpty}
                  />
                </div>

                {(stockEmpty || dirtyMissing > 0 || cleanShort > 0) ? (
                  <div className="hk-variance-row">
                    {stockEmpty ? (
                      <span className="hk-variance-msg oos-line">⚠ Storage empty — clean placement disabled.</span>
                    ) : null}
                    {dirtyMissing > 0 ? (
                      <span className="hk-variance-msg missing">
                        ⚠ {dirtyMissing} item{dirtyMissing > 1 ? 's' : ''} missing — pulled {d} of standard {std}.
                        <Link href={`/issue?entryContext=MISSING_FROM_ROOM&roomId=${room.id}&catalogItemId=${item.id}&qtyShort=${dirtyMissing}`}>
                          Report missing?
                        </Link>
                      </span>
                    ) : null}
                    {!stockEmpty && cleanShort > 0 ? (
                      <span className="hk-variance-msg belowstd">Below standard placement — placed {c} of {std}.</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <EvidenceCapture value={evidence} onChange={setEvidence} />
      </TaskFrame>
  );
}

function CounterBlock({
  variant,
  label,
  value,
  max,
  onChange,
  standard,
  disabled = false,
}: {
  variant: 'dirty' | 'clean' | 'disabled';
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  standard: number;
  disabled?: boolean;
}) {
  return (
    <div className={`hk-counter-block ${variant}`}>
      <div className="hk-counter-meta">
        <span className="hk-counter-label">{label}</span>
        <span className="hk-counter-sub">of {standard}</span>
      </div>
      <div className="hk-mini-stepper">
        <button
          type="button"
          className="hk-ms-btn"
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          −
        </button>
        <span className="hk-ms-count">
          {value}
          <span className="of">/{standard}</span>
        </span>
        <button
          type="button"
          className="hk-ms-btn"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function LaundryReceiveClient({ snapshot }: { snapshot: any }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [evidence, setEvidence] = useState(defaultEvidence);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = snapshot.items ?? [];
  const totalTypes = rows.length;
  const totalExpected = rows.reduce((sum: number, item: any) => sum + (item.expectedBack ?? 0), 0);
  const done = rows.filter((item: any) => (qty[item.catalogItemId] ?? 0) >= (item.expectedBack ?? 0)).length;

  let totalShort = 0;
  let totalOver = 0;
  for (const item of rows) {
    const received = qty[item.catalogItemId] ?? 0;
    const expected = item.expectedBack ?? 0;
    if (received < expected) totalShort += expected - received;
    if (received > expected) totalOver += received - expected;
  }
  const anyTouched = rows.some((item: any) => qty[item.catalogItemId] !== undefined);
  const helperText = !anyTouched
    ? 'Add counts for each item type'
    : totalShort > 0
      ? `${totalShort} piece${totalShort === 1 ? '' : 's'} short — vendor will be flagged`
      : totalOver > 0
        ? `${totalOver} piece${totalOver === 1 ? '' : 's'} over expected — confirm before submit`
        : 'All clean items received';
  const helperTone: 'ok' | 'warn' | undefined = !anyTouched
    ? undefined
    : totalShort > 0 || totalOver > 0
      ? 'warn'
      : 'ok';

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        items: rows.map((item: any) => ({ catalogItemId: item.catalogItemId, receivedQty: qty[item.catalogItemId] ?? 0 })),
        evidence,
      };
      const res = await fetch('/api/laundry-logs/receive', {
        method: 'POST',
        headers: syncHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        location.href = '/laundry-in';
        return;
      }
      // Surface the real failure instead of a silent no-op. Reads the server's
      // JSON error envelope (`{ code, message }`) when present.
      const body = await res.json().catch(() => null);
      const message = body?.message ?? body?.code ?? `Request failed (${res.status})`;
      setError(message);
      console.error('[laundry-receive] submit failed', { status: res.status, body });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      console.error('[laundry-receive] submit exception', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TaskFrame
      title="Receive from Laundry"
      eyebrow="Receive"
      subtitle={`${formatIstDate(new Date().toISOString())} · ${snapshot.vendorName}`}
      back="/laundry-in"
      progress={{ done, total: totalTypes, label: 'Items recorded' }}
      disabled={rows.length === 0 || !anyTouched || submitting}
      helperText={error ? `Submit failed: ${error}` : rows.length === 0 ? undefined : helperText}
      helperTone={error ? 'warn' : rows.length === 0 ? undefined : helperTone}
      onSubmit={submit}
      cta={submitting ? 'Submitting…' : 'Mark Receive Complete'}
    >
      {rows.length === 0 ? (
        <div className="hk-empty">
          <div className="hk-empty-illus" aria-hidden>✓</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>No actions needed</div>
          <div style={{ fontSize: 13, color: '#5C7170', lineHeight: 1.5, maxWidth: 280 }}>
            All laundry has been received — nothing waiting at the dock right now.
            New cycles will appear here as soon as housekeeping sends linens out.
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="hk-cycle-card">
          <span className="cc-ico" aria-hidden>↻</span>
          <div className="cc-text">
            {snapshot.openCycleCount} open cycle{snapshot.openCycleCount === 1 ? '' : 's'} will close in order (oldest first, FIFO).
            <span className="hint">{totalTypes} item type{totalTypes === 1 ? '' : 's'} · {totalExpected} pieces expected</span>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="hk-section-head">
          <span>Count returned linen</span>
          <span className="count">{totalTypes} item type{totalTypes === 1 ? '' : 's'} · {totalExpected} expected</span>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="hk-linen-list">
          {rows.map((item: any) => {
            const received = qty[item.catalogItemId] ?? 0;
            const expected = item.expectedBack ?? 0;
            const short = received < expected;
            const over = received > expected;
            const categoryKind = item.linenCategory === 'PERIODIC' ? 'periodic' : 'routine';
            const categoryLabel = item.linenCategory === 'PERIODIC' ? 'Periodic' : 'Routine';
            return (
              <div key={item.catalogItemId} className={short && anyTouched ? 'hk-linen-row short' : 'hk-linen-row'}>
                <div className="hk-linen-row-top">
                  <span className="hk-item-ico" aria-hidden>
                    <Shirt size={18} />
                  </span>
                  <div className="hk-item-body">
                    <div className="hk-item-name">{item.name}</div>
                    <div className="hk-item-meta-row">
                      <span className={`hk-cat-chip ${categoryKind}`}>{categoryLabel}</span>
                      <span className="hk-expected-badge">Expected: {expected}</span>
                    </div>
                  </div>
                </div>

                <div className="hk-receive-counter">
                  <div className="rc-meta">
                    <span className="rc-label">Received</span>
                    <span className="rc-sub">clean pieces counted on dock</span>
                  </div>
                  <div className="hk-mini-stepper">
                    <button
                      type="button"
                      className="hk-ms-btn"
                      disabled={received <= 0}
                      onClick={() => setQty({ ...qty, [item.catalogItemId]: Math.max(0, received - 1) })}
                      aria-label="Decrease received"
                    >
                      −
                    </button>
                    <span className="hk-ms-count">
                      {received}
                      <span className="of">/{expected}</span>
                    </span>
                    <button
                      type="button"
                      className="hk-ms-btn"
                      disabled={received >= expected + 3}
                      onClick={() => setQty({ ...qty, [item.catalogItemId]: Math.min(expected + 3, received + 1) })}
                      aria-label="Increase received"
                    >
                      +
                    </button>
                  </div>
                </div>

                {(short && anyTouched) || over ? (
                  <div className="hk-variance-row">
                    {short && anyTouched ? (
                      <span className="hk-variance-msg short">⚠ −{expected - received} short — vendor will be flagged.</span>
                    ) : null}
                    {over ? (
                      <span className="hk-variance-msg over">
                        +{received - expected} over expected.
                        <Link
                          href={`/issue?entryContext=DAMAGED_ON_RETURN&catalogItemId=${item.catalogItemId}&qty=1&vendorName=${encodeURIComponent(snapshot.vendorName)}`}
                        >
                          Report damaged?
                        </Link>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="hk-section-head" style={{ marginTop: 14 }}>
            <span>Notes &amp; evidence</span>
            <span className="count">Optional</span>
          </div>
          <EvidenceCapture value={evidence} onChange={setEvidence} />
        </>
      ) : null}
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

type TaskFrameProps = {
  title: string;
  eyebrow?: string;
  // Context line under the title (e.g. "Deluxe King — standard set"). Wireframe `.header-sub`.
  subtitle?: string;
  back?: string;
  // Visual variant for the header chrome (wireframe 07 — periodic accent).
  headerVariant?: 'periodic';
  // Optional progress strip rendered inside the sticky header (wireframe 04–06).
  // `label` sits on the left (e.g. "Items recorded"), counter on the right.
  progress?: { done: number; total: number; label?: string };
  children: ReactNode;
  disabled: boolean;
  // Helper line above the sticky CTA. Always rendered when present — both for
  // disabled-state explanations ("Complete all items first") and positive
  // confirmations ("Looks good"). `tone` switches the colour.
  helperText?: string;
  helperTone?: 'ok' | 'warn';
  onSubmit: () => void;
  cta: string;
  nav?: boolean;
};

function TaskFrame({
  title,
  eyebrow,
  subtitle,
  back = '..',
  headerVariant,
  progress,
  children,
  disabled,
  helperText,
  helperTone,
  onSubmit,
  cta,
  nav = false,
}: TaskFrameProps) {
  const headerExtra = progress ? (
    <>
      <div className="hk-progress-row">
        <span>{progress.label ?? 'Progress'}</span>
        <span className="counter">
          {progress.done} of {progress.total}
        </span>
      </div>
      <div className="hk-progress-bar-wrap">
        <div
          className="hk-progress-bar-fill"
          style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
        />
      </div>
    </>
  ) : null;

  return (
    <PwaShell title={title} eyebrow={eyebrow} subtitle={subtitle} back={back} nav={nav} headerExtra={headerExtra} headerVariant={headerVariant}>
      <div style={{ padding: '14px 16px 120px' }}>{children}</div>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: nav ? 70 : 0,
          maxWidth: 430,
          margin: '0 auto',
          padding: 12,
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid #DBE7E4',
        }}
      >
        {helperText ? (
          <div className={`hk-cta-hint${helperTone ? ` ${helperTone}` : ''}`}>{helperText}</div>
        ) : null}
        <button className="hk-cta" type="button" disabled={disabled} onClick={onSubmit}>
          {cta}
        </button>
      </div>
    </PwaShell>
  );
}
