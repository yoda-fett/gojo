'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PinSetupForm } from '@/components/auth/pin-setup-form';

export function SetPinInterstitial() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  async function handleSubmit(pin: string) {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/auth/pin/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (mounted.current) {
        setError(payload.message ?? 'Could not set PIN.');
        setSubmitting(false);
      }
      return;
    }
    try {
      const raw = window.localStorage.getItem('gojo:signin:device');
      if (raw) {
        const parsed = JSON.parse(raw);
        window.localStorage.setItem(
          'gojo:signin:device',
          JSON.stringify({ ...parsed, hasPin: true, ts: Date.now() }),
        );
      }
    } catch {
      /* ignore */
    }
    router.push('/dashboard');
    router.refresh();
  }

  function handleSkip() {
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="signin-screen">
      <aside className="signin-hero">
        <div className="signin-hero-logo">Gojo</div>
        <div className="signin-hero-tag">HOSPITALITY, SIMPLIFIED</div>
        <h2>One quick step — create a PIN</h2>
        <p>Sign in faster next time. You can skip and do this later from your account.</p>
      </aside>

      <main className="signin-pane">
        <div className="signin-card">
          <h3>Create a PIN</h3>
          <p className="signin-subtitle">Choose a 4-digit PIN for faster sign-in.</p>
          <PinSetupForm
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            skipLabel="Skip for now"
          />
        </div>
      </main>
    </div>
  );
}
