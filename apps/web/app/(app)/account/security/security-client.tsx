'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PinSetupForm } from '@/components/auth/pin-setup-form';

type Props = { phone: string; hasPin: boolean };
type Stage = 'idle' | 'otp' | 'set' | 'done';

const LEN = 6;

export function SecurityClient({ phone, hasPin: initialHasPin }: Props) {
  const router = useRouter();
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [stage, setStage] = useState<Stage>('idle');
  const [sessionId, setSessionId] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(LEN).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (stage === 'otp') otpRefs.current[0]?.focus();
  }, [stage]);

  async function startReauth() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone }),
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.message ?? 'Could not send OTP.');
      return;
    }
    setSessionId(payload.sessionId);
    setOtpDigits(Array(LEN).fill(''));
    setStage('otp');
    setInfo(payload.reusedExistingSession ? 'A recent code is still active.' : 'Code sent. In dev, use 123456.');
  }

  function handleOtpChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      if (digit && index < LEN - 1) otpRefs.current[index + 1]?.focus();
      const joined = next.join('');
      if (joined.length === LEN && next.every((d) => d !== '')) {
        void verifyOtp(joined);
      }
      return next;
    });
  }

  async function verifyOtp(code: string) {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId, otp: code }),
    });
    const payload = await res.json();
    setVerifying(false);
    if (!res.ok) {
      setError(payload.message ?? 'Could not verify code.');
      setOtpDigits(Array(LEN).fill(''));
      otpRefs.current[0]?.focus();
      return;
    }
    setStage('set');
    setInfo(null);
  }

  async function handlePinSubmit(pin: string) {
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/auth/pin/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.message ?? 'Could not save PIN.');
      return;
    }
    setHasPin(true);
    setStage('done');
    setInfo('PIN updated.');
    router.refresh();
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 rounded-md border border-[var(--color-border)] p-4">
        <div className="text-sm font-medium text-[var(--color-dark-gray)]">PIN sign-in</div>
        <div className="mt-1 text-sm text-[var(--color-mid-gray)]">
          {hasPin
            ? 'A PIN is set on this account. You can change it any time.'
            : 'No PIN is set. Create a 4-digit PIN for faster sign-in.'}
        </div>
      </div>

      {stage === 'idle' ? (
        <button
          type="button"
          onClick={startReauth}
          disabled={submitting}
          className="rounded-md bg-[var(--color-teal)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Sending OTP…' : hasPin ? 'Change PIN' : 'Set PIN'}
        </button>
      ) : null}

      {stage === 'otp' ? (
        <div className="signin-otp-pin">
          <span className="signin-section-label">Enter the code we sent to {phone}</span>
          <div className={`signin-digits${verifying ? ' is-verifying' : ''}`} role="group" aria-label="OTP">
            {otpDigits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={d}
                disabled={verifying}
                aria-label={`OTP digit ${i + 1}`}
                className={`signin-digit${d ? ' is-filled' : ''}`}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus();
                }}
                onFocus={(e) => e.currentTarget.select()}
              />
            ))}
          </div>
          <div className="signin-otp-helper">{verifying ? 'Verifying…' : 'Auto-submits on the 4th digit.'}</div>
        </div>
      ) : null}

      {stage === 'set' ? (
        <div className="mt-4">
          <PinSetupForm
            submitting={submitting}
            error={error}
            onSubmit={handlePinSubmit}
          />
        </div>
      ) : null}

      {stage !== 'set' && error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      {info ? <div className="mt-3 text-sm text-[var(--color-teal)]">{info}</div> : null}
    </div>
  );
}
