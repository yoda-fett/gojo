'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BrandHeader } from '@/components/ui/brand-header';
import { PinInput } from '@/components/ui/pin-input';

export function PinSetClient({ hasPin }: { hasPin: boolean }) {
  const router = useRouter();
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const pinsMatch = newPin.length === 4 && newPin === confirmPin;
  const title = hasPin ? 'Change PIN' : 'Set PIN';

  async function save() {
    if (!pinsMatch) {
      setError('PINs do not match');
      return;
    }
    setError('');
    setSubmitting(true);
    const res = await fetch('/api/auth/pin/set', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    });
    const payload = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.message ?? 'Unable to save PIN');
      setNewPin('');
      setConfirmPin('');
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <main className="hk-screen hk-screen--auth">
      <BrandHeader />
      <section style={{ flex: 1 }}>
        <h2 className="hk-form-title">{title}</h2>
        <p className="hk-form-help">
          {hasPin
            ? 'Enter a new 4-digit PIN. The next sign-in will require it.'
            : 'Set a 4-digit PIN to sign in faster next time.'}
        </p>

        {done ? (
          <>
            <p style={{ color: '#1DA888', fontWeight: 600, marginTop: 16 }}>
              {hasPin ? 'PIN updated.' : 'PIN set.'}
            </p>
            <Link
              href="/profile"
              className="hk-cta"
              style={{ marginTop: 16, width: '100%', textAlign: 'center', display: 'block' }}
            >
              Back to Profile
            </Link>
          </>
        ) : (
          <>
            <PinInput label="New PIN" value={newPin} onChange={setNewPin} />
            <div style={{ height: 16 }} />
            <PinInput
              key={newPin.length >= 4 ? 'confirm-focus' : 'confirm-idle'}
              label="Confirm PIN"
              value={confirmPin}
              onChange={setConfirmPin}
              autoFocus={newPin.length >= 4}
            />
            <p className="hk-pin-status">Both fields must match</p>
            <button
              type="button"
              className="hk-cta"
              style={{ marginTop: 8 }}
              disabled={!pinsMatch || submitting}
              onClick={() => void save()}
            >
              {submitting ? 'Saving…' : hasPin ? 'Update PIN' : 'Save PIN'}
            </button>
            <Link
              href="/profile"
              className="hk-cta hk-cta-secondary"
              style={{ marginTop: 8, width: '100%', textAlign: 'center', display: 'block' }}
            >
              Cancel
            </Link>
          </>
        )}

        {error ? <p className="hk-error">{error}</p> : null}
      </section>
    </main>
  );
}
