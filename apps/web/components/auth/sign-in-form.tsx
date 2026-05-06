'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

type VerifyResponse =
  | {
      userId: string;
      defaultPropertyId?: string;
      properties?: Array<{
        propertyId: string;
        propertyName: string;
        role: string;
      }>;
    }
  | {
      code: string;
      message: string;
    };

function normalizePhone(digitsOnly: string) {
  return digitsOnly ? `+91${digitsOnly}` : '';
}

function displayPhone(value: string) {
  if (!value) {
    return '';
  }

  if (value.startsWith('+91') && value.length <= 13) {
    const local = value.slice(3);
    return `+91 ${local}`;
  }

  return value;
}

function sessionStorageKey(phone: string) {
  return `gojo:otp-session:${phone}`;
}

export function SignInForm() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const normalizedPhone = useMemo(() => normalizePhone(phoneDigits), [phoneDigits]);
  const phoneReady = phoneDigits.length === 10;
  const otpReady = otp.trim().length >= 4;

  useEffect(() => {
    if (typeof window === 'undefined' || !phoneReady) {
      return;
    }

    const existingSessionId = window.sessionStorage.getItem(sessionStorageKey(normalizedPhone));
    if (existingSessionId) {
      setSessionId(existingSessionId);
    }
  }, [normalizedPhone, phoneReady]);

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phoneReady) {
      setError('Enter a valid mobile number to continue.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setInfo(null);

    const response = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone }),
    });

    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.message ?? 'Unable to request OTP right now.');
      return;
    }

    setSessionId(payload.sessionId);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(sessionStorageKey(normalizedPhone), payload.sessionId);
    }
    setStep('otp');
    setInfo(
      payload.reusedExistingSession
        ? 'A recent OTP is still active for this number. In local development, use 1234.'
        : 'Code sent. In local development, use 1234.',
    );
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpReady) {
      setError('Enter the 4-digit OTP to continue.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setInfo(null);

    const response = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId, otp: otp.trim() }),
    });

    const payload = (await response.json()) as VerifyResponse;
    setSubmitting(false);

    if (!response.ok) {
      setError('message' in payload ? payload.message : 'Unable to verify OTP.');
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(sessionStorageKey(normalizedPhone));
    }

    if ('properties' in payload && payload.properties && payload.properties.length > 1) {
      setInfo(`Signed in. Opening ${payload.properties[0]?.propertyName ?? 'your property'} for now.`);
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="gojo-auth-layout">
      <section className="gojo-auth-card gojo-auth-content">
        <p className="gojo-eyebrow">Gojo Access</p>
        <h1>{step === 'phone' ? 'Sign in with your mobile number' : 'Enter your verification code'}</h1>
        <p className="gojo-copy">
          {step === 'phone'
            ? 'Use your registered staff number to access the owner dashboard, bookings, and operating tools.'
            : `We sent a code to ${displayPhone(normalizedPhone)}. Enter it below to start your shift.`}
        </p>

        {step === 'phone' ? (
          <form className="gojo-auth-form" onSubmit={requestOtp}>
            <label className="gojo-auth-field">
              <span>Mobile Number</span>
              <div className="gojo-auth-phone-input">
                <span className="gojo-auth-phone-prefix" aria-label="Country code +91">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  maxLength={10}
                  value={phoneDigits}
                  onChange={(event) => setPhoneDigits(event.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
            </label>
            <Button type="submit" disabled={submitting || !phoneReady} className="gojo-auth-submit">
              {submitting ? 'Sending code...' : 'Get OTP'}
            </Button>
            {sessionId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setError(null);
                  setInfo('Continuing with your active OTP session.');
                  setStep('otp');
                }}
              >
                I already have a code
              </Button>
            ) : null}
          </form>
        ) : (
          <form className="gojo-auth-form" onSubmit={verifyOtp}>
            <label className="gojo-auth-field">
              <span>One-Time Password</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="1234"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
              />
            </label>
            <div className="gojo-auth-actions">
              <Button type="submit" disabled={submitting || !otpReady} className="gojo-auth-submit">
                {submitting ? 'Verifying...' : 'Verify OTP'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setInfo(null);
                  setError(null);
                }}
              >
                Change Number
              </Button>
            </div>
          </form>
        )}

        {info ? <p className="gojo-auth-message gojo-auth-message-info">{info}</p> : null}
        {error ? <p className="gojo-auth-message gojo-auth-message-error">{error}</p> : null}

        <div className="gojo-auth-footnote">
          <p>Local development uses the mock OTP provider.</p>
          <strong>Use code 1234 after requesting an OTP.</strong>
        </div>
      </section>

      <aside className="gojo-auth-side gojo-panel">
        <p className="gojo-eyebrow">Desk Ready</p>
        <h2>One login for owners, managers, and front-desk ops.</h2>
        <p className="gojo-copy">
          The same access flow unlocks bookings, CRS calendar, rate controls, and revenue visibility without leaving the Gojo shell.
        </p>
        <ul className="gojo-auth-feature-list">
          <li>OTP sign-in with secure session cookies</li>
          <li>Property-scoped access with seeded demo users</li>
          <li>Mock OTP support for fast local setup</li>
        </ul>
      </aside>
    </div>
  );
}
