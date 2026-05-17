'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EndShiftSheet } from './end-shift-sheet';
import { PwaShell } from './pwa-shell';
import type { RoomCardData } from './room-card-mobile';

export function ProfileClient({
  dateLabel,
  userInitial,
  incomplete,
  filedMissing,
  filedDamaged,
  hasPin,
}: {
  dateLabel: string;
  userInitial: string;
  incomplete: RoomCardData[];
  filedMissing: number;
  filedDamaged: number;
  hasPin: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <PwaShell title="Profile" dateLabel={dateLabel} userInitial={userInitial}>
      <section style={{ margin: '0 16px', background: '#fff', border: '1px solid #E8EFEE', borderRadius: 14, padding: 18 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>End Shift</p>
        <p style={{ color: '#5C7170', fontSize: 14, lineHeight: 1.5 }}>
          Today you filed: {filedMissing} missing items, {filedDamaged} damaged returns.
        </p>
        <button type="button" className="hk-cta" style={{ marginTop: 14 }} onClick={() => setSheetOpen(true)}>
          End Shift
        </button>
      </section>
      <EndShiftSheet
        open={sheetOpen}
        incomplete={incomplete}
        onDismiss={() => setSheetOpen(false)}
        onEndAnyway={() => setSheetOpen(false)}
      />
      <section style={{ margin: '16px 16px 0', background: '#fff', border: '1px solid #E8EFEE', borderRadius: 14, padding: 18 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{hasPin ? 'Change PIN' : 'Set PIN'}</p>
        <p style={{ color: '#5C7170', fontSize: 14, lineHeight: 1.5, marginTop: 6 }}>
          {hasPin
            ? 'Update your 4-digit PIN used for quick sign-in.'
            : 'Set a 4-digit PIN to sign in faster next time.'}
        </p>
        <Link
          href="/profile/pin"
          className="hk-cta hk-cta-secondary"
          style={{ marginTop: 14, width: '100%', textAlign: 'center', display: 'block' }}
        >
          {hasPin ? 'Change PIN' : 'Set PIN'}
        </Link>
      </section>
      <section style={{ margin: '16px 16px 0', background: '#fff', border: '1px solid #E8EFEE', borderRadius: 14, padding: 18 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Sign out</p>
        <p style={{ color: '#5C7170', fontSize: 14, lineHeight: 1.5, marginTop: 6 }}>
          End your session and return to the sign-in screen.
        </p>
        <button
          type="button"
          className="hk-cta hk-cta-secondary"
          style={{ marginTop: 14, width: '100%' }}
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          {loggingOut ? 'Signing out…' : 'Log out'}
        </button>
      </section>
    </PwaShell>
  );
}
