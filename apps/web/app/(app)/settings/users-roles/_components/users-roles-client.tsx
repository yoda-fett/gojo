// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';

// Story 12.7e — Users & Roles client.
// All mutations hit the existing Story 2.5 endpoints. Refetch list after each
// mutation. "Resend invite" re-POSTs the same { phone, role } — the team
// route already handles re-invite of PENDING rows (updates invitedAt + new
// OTP). No raw user IDs are rendered; userId in row state is for wiring only.

type Row = {
  userId: string;
  displayName: string | null;
  phoneMasked: string;
  role: 'OWNER' | 'MANAGER' | 'FRONT_DESK' | 'HOUSEKEEPING';
  status: 'PENDING' | 'ACTIVE';
  isSelf: boolean;
};

type Property = {
  id: string;
  name: string;
  location: string;
  role: string;
  isCurrent: boolean;
};

const TEAL = '#1DA888';
const CHARCOAL = '#1A2B2E';
const MUTED = '#9EAEAC';
const BORDER = '#E8EFEE';
const SOFT = '#F4F9F8';

const INVITABLE_ROLES = ['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING'] as const;

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Co-owner',
  MANAGER: 'Manager',
  FRONT_DESK: 'Front desk',
  HOUSEKEEPING: 'Housekeeping',
};

function initials(row: Row): string {
  if (row.displayName) {
    const parts = row.displayName.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }
  return '?';
}

export function UsersRolesClient({
  propertyId,
  propertyName,
  initialRows,
  properties,
}: {
  propertyId: string;
  propertyName: string;
  initialRows: Row[];
  properties: Property[];
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>('MANAGER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<Row | null>(null);

  const summary = useMemo(() => {
    const active = rows.filter((r) => r.status === 'ACTIVE').length;
    const pending = rows.filter((r) => r.status === 'PENDING').length;
    return { total: rows.length, active, pending };
  }, [rows]);

  // More than one OWNER on this property → owners are shown as "Co-owner";
  // a sole owner is shown as "Owner".
  const multipleOwners = rows.filter((r) => r.role === 'OWNER').length > 1;

  async function refetch() {
    const res = await fetch(`/api/properties/${propertyId}/team`, { cache: 'no-store' });
    if (res.ok) setRows(await res.json());
  }

  async function invite() {
    setError(null);
    setInfo(null);
    const normalized = phone.replace(/\s/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(normalized)) {
      setError('Enter a valid mobile number.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Invite failed.');
        return;
      }
      await refetch();
      setShowForm(false);
      setPhone('');
      setRole('MANAGER');
      setInfo('Invitation sent.');
    } finally {
      setBusy(false);
    }
  }

  async function resend(row: Row) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      // The team POST re-invites a PENDING row in place (updates invitedAt + new OTP).
      // We don't have the raw phone client-side — but the server can match by userId via the existing POST shape only if we send phone.
      // Workaround: derive the unmasked phone from a tiny GET on the row (not exposed). Instead, send a `userId` resend flag.
      const res = await fetch(`/api/properties/${propertyId}/team/${row.userId}/resend`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Resend failed.');
        return;
      }
      await refetch();
      setInfo(`Invitation resent to ${row.phoneMasked}.`);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(row: Row) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/team/${row.userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Revoke failed.');
        return;
      }
      await refetch();
      setConfirmRevoke(null);
      setInfo('Access revoked.');
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
          eyebrow={[{ label: 'Settings', href: '/settings' }, { label: 'Users & Roles' }]}
          title="Users & Roles"
          subtitle={
            <>
              Invite your team to <strong>{propertyName}</strong> and assign each person a role. Invitations are sent as
              an OTP link to their mobile number — they join by completing OTP sign-in.
            </>
          }
        />
      }
    >
      <div className="flex flex-col gap-5">
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

      {/* Team members card */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(26,43,46,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>Team members</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              {summary.total} member{summary.total === 1 ? '' : 's'} · {summary.active} active ·{' '}
              {summary.pending} pending invitation{summary.pending === 1 ? '' : 's'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setError(null);
              setInfo(null);
            }}
            disabled={busy || showForm}
            style={{ ...btnPrimary, padding: '7px 14px', fontSize: 13 }}
          >
            + Invite team member
          </button>
        </div>

        {showForm && (
          <div
            style={{
              margin: '20px 20px 0',
              border: `1px dashed ${TEAL}`,
              borderRadius: 10,
              background: SOFT,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F7A5E', marginBottom: 14 }}>✎ Invite team member</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
              <Field label="Mobile number" hint="10-digit Indian mobile · the OTP invitation is sent here">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  style={input}
                />
              </Field>
              <Field label="Role" hint="Co-owner has full owner access to this property">
                <select value={role} onChange={(e) => setRole(e.target.value as any)} style={input}>
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div
              style={{
                marginTop: 14,
                background: '#F4F9F8',
                border: '1px solid #D6F2EA',
                borderLeft: `3px solid ${TEAL}`,
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 12,
                color: '#0F7A5E',
              }}
            >
              <strong>OTP-based invitation.</strong> A <code>PENDING</code> access row is created and an OTP link is
              sent to this number. The invitee joins by entering the OTP on sign-in.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} disabled={busy} style={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={() => void invite()} disabled={busy} style={btnPrimary}>
                Send invitation
              </button>
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAFCFC' }}>
              <th style={th(34)}>Member</th>
              <th style={th(20)}>Role</th>
              <th style={th(16)}>Status</th>
              <th style={{ ...th(30), textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: r.status === 'PENDING' ? '#EEF2F2' : '#D6F2EA',
                        color: r.status === 'PENDING' ? MUTED : '#0F7A5E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {r.displayName ? initials(r) : '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: r.displayName ? CHARCOAL : MUTED }}>
                        {r.displayName ?? r.phoneMasked}
                        {r.isSelf && (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: '2px 8px',
                              background: '#EEF2F2',
                              color: '#5C7170',
                              borderRadius: 100,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            You
                          </span>
                        )}
                      </div>
                      {r.displayName && (
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{r.phoneMasked}</div>
                      )}
                      {!r.displayName && (
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                          Name set once the invitee completes OTP sign-in
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={td}>
                  <RolePill role={r.role} />
                </td>
                <td style={td}>
                  <StatusPill status={r.status} />
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {r.status === 'PENDING' && (
                      <button type="button" onClick={() => void resend(r)} disabled={busy} style={iconBtn()}>
                        Resend invite
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmRevoke(r)}
                      disabled={busy || r.isSelf}
                      style={iconBtn(true, r.isSelf)}
                      title={r.isSelf ? 'You cannot revoke your own access (CANNOT_REVOKE_SELF)' : undefined}
                    >
                      Revoke
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {confirmRevoke && (
          <div
            style={{
              margin: '0 20px 20px',
              padding: '14px 16px',
              background: '#FFF6F1',
              border: '1px solid #F4D5C7',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, fontSize: 13, color: '#1A2B2E' }}>
              Revoke access for{' '}
              <strong style={{ color: '#B5572A' }}>
                {confirmRevoke.displayName ?? confirmRevoke.phoneMasked} ({confirmRevoke.role})
              </strong>
              ? Their access is soft-deleted and any active session is invalidated within 60 seconds. Recorded in the audit trail.
            </div>
            <button type="button" onClick={() => setConfirmRevoke(null)} disabled={busy} style={btnGhost}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void revoke(confirmRevoke)}
              disabled={busy}
              style={{ ...btnPrimary, background: '#B5572A' }}
            >
              Revoke access
            </button>
          </div>
        )}
      </div>

      {/* Co-owner / multi-property card (AC5) */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(26,43,46,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>Co-owner & multi-property access</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
            One Gojo account can own or access several properties
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: '#5C7170', lineHeight: 1.6 }}>
            A single account is not tied to one hotel. If you own more than one property — or a co-owner / manager is
            invited to several — every property they have access to appears in a <strong>property selector at sign-in</strong>.
            Roles are per-property.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {properties.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#D6F2EA',
                    color: '#0F7A5E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                  }}
                >
                  🏨
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>
                    {p.location}
                    {p.isCurrent ? ' · current property' : ''}
                  </div>
                </div>
                <RolePill
                  role={p.role as Row['role']}
                  label={
                    p.role === 'OWNER' ? (multipleOwners ? 'Co-owner' : 'Owner') : undefined
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </PageShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: MUTED }}>{hint}</span>}
    </div>
  );
}

function RolePill({ role, label }: { role: Row['role']; label?: string }) {
  const map = {
    OWNER: { bg: '#E8DAF2', fg: '#6B3FA0' },
    MANAGER: { bg: '#DCE9F2', fg: '#3A6FA0' },
    FRONT_DESK: { bg: '#FBF1D5', fg: '#B5853A' },
    HOUSEKEEPING: { bg: '#EEF2F2', fg: '#5C7170' },
  } as const;
  const c = map[role as keyof typeof map] ?? map.HOUSEKEEPING;
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '3px 10px',
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {label ?? role}
    </span>
  );
}

function StatusPill({ status }: { status: Row['status'] }) {
  const c =
    status === 'ACTIVE'
      ? { bg: '#D6F2EA', fg: '#0F7A5E', label: 'Active' }
      : { bg: '#FBF1D5', fg: '#B5853A', label: 'Pending' };
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '3px 10px',
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {c.label}
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

const iconBtn = (danger = false, disabled = false): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: `1px solid ${danger ? '#F4D5C7' : BORDER}`,
  background: '#fff',
  color: disabled ? '#C5D0CF' : danger ? '#B5572A' : CHARCOAL,
  cursor: disabled ? 'not-allowed' : 'pointer',
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
