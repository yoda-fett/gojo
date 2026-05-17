// @ts-nocheck
'use client';

// Story 12.6 — Variance table per wireframe 07. Rows are pre-sorted by
// severity (SIGNIFICANT → STANDARD → CLEAN) server-side; the toggle here
// hides CLEAN rows by default. Mark-reviewed calls /review and flips into
// read-only mode (AC5). After review, the page can still be opened as a
// historical view (the row data is the source of truth).

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const TEAL = '#1DA888';
const CHARCOAL = '#1A2B2E';
const MUTED = '#9EAEAC';
const BORDER = '#E8EFEE';
const AMBER = '#FFF1E0';
const AMBER_STRONG = '#FCDCB0';

type Row = {
  catalogItemId: string;
  name: string;
  unit: string;
  linenCategory: string | null;
  totalOwned: number;
  declaredInRooms: number;
  observedInRooms: number;
  variance: number;
  variancePct: number;
  severity: 'CLEAN' | 'STANDARD' | 'SIGNIFICANT';
  suggestedAction: 'WRITE_OFF' | 'COUNTING_ERROR' | 'REDEPLOYMENT' | 'NONE';
};

export function ReconciliationClient({ reviewedAt, rows }: { reviewedAt: string | null; rows: Row[] }) {
  const router = useRouter();
  const [showClean, setShowClean] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => (showClean ? rows : rows.filter((r) => r.severity !== 'CLEAN')), [rows, showClean]);
  const significantCount = rows.filter((r) => r.severity === 'SIGNIFICANT').length;
  const standardCount = rows.filter((r) => r.severity === 'STANDARD').length;
  const cleanCount = rows.filter((r) => r.severity === 'CLEAN').length;

  async function markReviewed() {
    if (!confirm('Mark this reconciliation as reviewed? You can still open it later from the audit trail.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/reconciliation/review', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.message ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const isReadOnly = !!reviewedAt;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F9F8', padding: '28px 36px 60px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Onboarding · Reconciliation</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: CHARCOAL, marginTop: 4, letterSpacing: '-0.5px' }}>First-Shift Reconciliation</h1>
            <p style={{ fontSize: 13.5, color: '#5C7170', marginTop: 6, lineHeight: 1.55, maxWidth: 720 }}>
              We compared what you declared at cold-start against what housekeeping observed on the first complete sweep.
              Resolve any variance early so drift doesn't compound.
            </p>
            {reviewedAt ? (
              <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Reviewed {new Date(reviewedAt).toLocaleString()}</div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowClean((v) => !v)}
              style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: `1px solid ${BORDER}`, background: '#fff', color: CHARCOAL, cursor: 'pointer' }}
            >
              {showClean ? 'Hide clean rows' : 'Show all'}
            </button>
            {!isReadOnly ? (
              <button
                type="button"
                onClick={markReviewed}
                disabled={busy}
                style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: TEAL, color: '#fff', cursor: busy ? 'default' : 'pointer' }}
              >
                {busy ? 'Marking…' : 'Mark reviewed'}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: '#0F7A5E', fontWeight: 600 }}>✓ Reviewed</span>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 16, background: '#fff', padding: '18px 22px', borderRadius: 14, boxShadow: '0 1px 3px rgba(26,43,46,0.05)' }}>
          <Stat label="Significant variance" value={significantCount} tone="amber-strong" />
          <Stat label="Standard variance" value={standardCount} tone="amber" />
          <Stat label="Clean" value={cleanCount} tone="ok" />
          <Stat label="Items compared" value={rows.length} tone="neutral" />
        </div>

        {error ? <div style={{ padding: 12, background: 'rgba(181,87,42,0.10)', borderRadius: 10, color: '#B5572A', fontSize: 12.5 }}>{error}</div> : null}

        {/* Variance table */}
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(26,43,46,0.05)' }}>
          {visible.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: MUTED, fontSize: 13.5 }}>
              ✓ No variance to review — toggle "Show all" to see clean rows.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#FAFCFC' }}>
                  <Th>Item</Th>
                  <Th align="right">Declared</Th>
                  <Th align="right">Observed</Th>
                  <Th align="right">Variance</Th>
                  <Th align="right">% of total</Th>
                  <Th>Suggested action</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const bg = row.severity === 'SIGNIFICANT' ? AMBER_STRONG : row.severity === 'STANDARD' ? AMBER : '#fff';
                  return (
                    <tr key={row.catalogItemId} style={{ background: bg, borderBottom: `1px solid #F0F4F4` }}>
                      <Td>
                        <div style={{ fontWeight: 700, color: CHARCOAL }}>{row.name}</div>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          {row.linenCategory ? `${row.linenCategory} · ` : ''}{row.unit} · totalOwned {row.totalOwned}
                        </div>
                      </Td>
                      <Td align="right" mono>{row.declaredInRooms}</Td>
                      <Td align="right" mono>{row.observedInRooms}</Td>
                      <Td align="right" mono><strong style={{ color: row.severity === 'CLEAN' ? '#0F7A5E' : '#6A4A0F' }}>{row.variance > 0 ? `+${row.variance}` : row.variance}</strong></Td>
                      <Td align="right" mono>{row.variancePct.toFixed(1)}%</Td>
                      <Td>
                        <SuggestedActionLink row={row} disabled={isReadOnly} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, padding: '12px 16px', background: '#FAFCFC', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 12, color: '#5C7170' }}>
          <Swatch color={AMBER_STRONG} label="Significant (>10% of total)" />
          <Swatch color={AMBER} label="Standard (1–10%)" />
          <Swatch color="#fff" border={BORDER} label="Clean (0%)" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: any) {
  const palette: Record<string, string> = {
    'amber-strong': '#B5853A',
    amber: '#B0942A',
    ok: TEAL,
    neutral: CHARCOAL,
  };
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.7 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: palette[tone] ?? CHARCOAL, lineHeight: 1.05, marginTop: 4 }}>{value}</div>
    </div>
  );
}
function Th({ children, align = 'left' }: any) {
  return <th style={{ textAlign: align, padding: '12px 22px', fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: `1px solid ${BORDER}` }}>{children}</th>;
}
function Td({ children, align = 'left', mono }: any) {
  return <td style={{ padding: '16px 22px', textAlign: align, verticalAlign: 'middle', fontVariantNumeric: mono ? 'tabular-nums' : undefined }}>{children}</td>;
}
function Swatch({ color, label, border }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: color, border: border ? `1px solid ${border}` : 'none' }} />
      <span>{label}</span>
    </div>
  );
}

function SuggestedActionLink({ row, disabled }: { row: Row; disabled: boolean }) {
  if (row.suggestedAction === 'NONE') {
    return <span style={{ fontSize: 12, color: MUTED }}>—</span>;
  }
  if (disabled) {
    return <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>{labelFor(row.suggestedAction)}</span>;
  }
  const href = hrefFor(row);
  return (
    <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 7, background: '#fff', border: `1px solid ${BORDER}`, fontSize: 12.5, fontWeight: 600, color: CHARCOAL, textDecoration: 'none' }}>
      {labelFor(row.suggestedAction)}
    </a>
  );
}

function labelFor(a: Row['suggestedAction']) {
  switch (a) {
    case 'WRITE_OFF': return 'Write-off (item missing)';
    case 'COUNTING_ERROR': return 'Counting error — re-confirm';
    case 'REDEPLOYMENT': return 'Re-deployment — allocate per-room';
    default: return '';
  }
}

function hrefFor(row: Row): string {
  if (row.suggestedAction === 'WRITE_OFF') {
    // Story 11.6 AC2 Inventory > Linens write-off pane, pre-filled.
    return `/inventory/linens?writeoff=${encodeURIComponent(row.catalogItemId)}&qty=${Math.abs(row.variance)}`;
  }
  const mode = row.suggestedAction === 'REDEPLOYMENT' ? '&mode=per-room' : '';
  return `/onboarding/linen-distribution?item=${encodeURIComponent(row.catalogItemId)}${mode}`;
}
