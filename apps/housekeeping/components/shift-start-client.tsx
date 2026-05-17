'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BrandHeader } from '@/components/ui/brand-header';

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function ShiftStartClient({
  userName,
  propertyName,
  dateLabel,
  roomsAssigned,
}: {
  userName: string;
  propertyName: string;
  dateLabel: string;
  roomsAssigned: number;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const initial = userName.trim()[0]?.toUpperCase() ?? 'S';
  const greeting = greetingFor(new Date());

  async function startShift() {
    setError('');
    setSubmitting(true);
    const res = await fetch('/api/auth/shift-start', { method: 'POST' });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? 'Unable to start shift');
      setSubmitting(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  async function signOut() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <main className="hk-screen hk-screen--auth">
      <BrandHeader />
      <div className="hk-sync-row">
        <span className="hk-sync-chip">
          <span className="dot" />
          Online · Synced
        </span>
      </div>

      <section style={{ flex: 1, textAlign: 'center', paddingTop: 8 }}>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 14px',
            borderRadius: '50%',
            background: 'rgba(29,168,136,0.15)',
            color: '#1DA888',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {initial}
        </div>
        <div style={{ fontSize: 14, color: '#5C7170' }}>{greeting},</div>
        <h2 className="hk-form-title" style={{ marginTop: 2 }}>
          {userName} 👋
        </h2>

        <div
          style={{
            margin: '18px 0 22px',
            background: '#fff',
            border: '1px solid #E8EFEE',
            borderRadius: 14,
            padding: '14px 16px',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <ShiftRow label="Property" value={propertyName} />
          <ShiftRow label="Today" value={`${dateLabel} · IST`} />
          <ShiftRow
            label="Rooms assigned"
            value={`${roomsAssigned} ${roomsAssigned === 1 ? 'room' : 'rooms'}`}
            valueColor="#1DA888"
          />
        </div>

        <button
          type="button"
          className="hk-cta"
          disabled={submitting || signingOut}
          onClick={() => void startShift()}
        >
          {submitting ? 'Starting…' : 'Start my shift →'}
        </button>
        <button
          type="button"
          className="hk-cta hk-cta-secondary"
          style={{ marginTop: 10 }}
          disabled={submitting || signingOut}
          onClick={() => void signOut()}
        >
          {signingOut ? 'Signing out…' : 'Not me — sign out'}
        </button>

        {error ? <p className="hk-error">{error}</p> : null}
      </section>
    </main>
  );
}

function ShiftRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#5C7170' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: valueColor ?? '#1A2B2E', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
