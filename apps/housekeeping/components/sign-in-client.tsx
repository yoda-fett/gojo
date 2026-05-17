'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { BrandHeader } from '@/components/ui/brand-header';
import { PinInput } from '@/components/ui/pin-input';

type Step = 'phone' | 'pin' | 'otp' | 'set-pin';

function formatPhone(digits: string) {
  if (digits.length < 10) return `+91 ${digits}`;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function AuthSyncChip() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return (
    <div className="hk-sync-row">
      <span className={`hk-sync-chip${online ? '' : ' offline'}`}>
        <span className="dot" />
        {online ? 'Online · Ready' : 'Offline · Will verify when online'}
      </span>
    </div>
  );
}

export function SignInClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const phoneReady = phone.length === 10;
  const formattedPhone = useMemo(() => formatPhone(phone), [phone]);
  const pinsMatch = newPin.length === 4 && newPin === confirmPin;

  async function goToShiftStart() {
    router.replace('/shift-start');
    router.refresh();
  }

  async function lookupPhone() {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.message ?? `Unable to look up phone (${res.status})`);
        return;
      }
      const hasPin = Boolean(payload.hasPin);
      if (hasPin) {
        setNeedsPinSetup(false);
        setPin('');
        setStep('pin');
        return;
      }
      setNeedsPinSetup(true);
      await requestOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function lookupAndForceOtp() {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.message ?? `Unable to look up phone (${res.status})`);
        return;
      }
      setNeedsPinSetup(!payload.hasPin);
      await requestOtp(payload.hasPin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function skipPinSetup() {
    await goToShiftStart();
  }

  async function requestOtp(forPinRecovery = false) {
    setError('');
    if (forPinRecovery) {
      setNeedsPinSetup(false);
    }
    setSubmitting(true);
    const otpRes = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const payload = await otpRes.json();
    setSubmitting(false);
    if (!otpRes.ok) {
      setError(payload.message ?? 'Unable to send OTP');
      return;
    }
    setSessionId(payload.sessionId);
    setOtp('');
    setStep('otp');
  }

  async function verifyPin(nextPin = pin) {
    setError('');
    setSubmitting(true);
    const res = await fetch('/api/auth/pin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, pin: nextPin }),
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.message ?? 'Invalid phone or PIN');
      setPin('');
      return;
    }
    await goToShiftStart();
  }

  async function verifyOtp(nextOtp = otp) {
    setError('');
    setSubmitting(true);
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, otp: nextOtp }),
    });
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.message ?? 'Invalid OTP');
      setOtp('');
      return;
    }
    if (needsPinSetup) {
      setNewPin('');
      setConfirmPin('');
      setStep('set-pin');
      return;
    }
    await goToShiftStart();
  }

  async function savePin() {
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
    const payload = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.message ?? 'Unable to save PIN');
      return;
    }
    await goToShiftStart();
  }

  useEffect(() => {
    if (step === 'pin' && pin.length === 4 && phoneReady && !submitting) void verifyPin(pin);
  }, [pin, step, phoneReady, submitting]);

  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && sessionId && !submitting) void verifyOtp(otp);
  }, [otp, step, sessionId, submitting]);

  useEffect(() => {
    if (step === 'set-pin' && pinsMatch && !submitting) void savePin();
  }, [step, pinsMatch, submitting, newPin, confirmPin]);

  return (
    <main className="hk-screen hk-screen--auth">
      <BrandHeader />
      <AuthSyncChip />

      {step === 'phone' ? (
        <section style={{ flex: 1 }}>
          <h2 className="hk-form-title">Sign in to your shift</h2>
          <p className="hk-form-help">
            Enter your registered mobile number. We&apos;ll recognise you and ask for your PIN or a one-time code.
          </p>
          <label className="hk-label">Mobile number</label>
          <div className="hk-phone-field">
            <div className="hk-phone-prefix">
              +91 <span style={{ fontSize: 10, color: '#9EAEAC' }}>🔒</span>
            </div>
            <input
              className="hk-phone-input"
              inputMode="numeric"
              value={phone}
              placeholder="98xxx xxxxx"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>
          <button
            type="button"
            className="hk-cta"
            style={{ marginTop: 24 }}
            disabled={!phoneReady || submitting}
            onClick={() => void lookupPhone()}
          >
            Continue
          </button>
          <p style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: '#5C7170' }}>
            <button
              type="button"
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                color: '#1DA888',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              disabled={!phoneReady || submitting}
              onClick={() => void lookupAndForceOtp()}
            >
              Login with OTP instead
            </button>
          </p>
        </section>
      ) : null}

      {step === 'pin' ? (
        <section style={{ flex: 1 }}>
          <h2 className="hk-form-title">Enter your 4-digit PIN</h2>
          <p className="hk-form-help">
            Welcome back, <strong>{formattedPhone}</strong>.{' '}
            <button
              type="button"
              style={{ border: 0, background: 'transparent', color: '#1DA888', fontWeight: 600 }}
              onClick={() => {
                setPin('');
                setStep('phone');
              }}
            >
              Change number
            </button>
          </p>
          <PinInput label="PIN" value={pin} onChange={setPin} />
          <p className="hk-pin-status live">Auto-submits on 4th digit — no Verify button</p>
          <button type="button" className="hk-cta hk-cta-secondary" onClick={() => void requestOtp(true)}>
            Forgot PIN? Login with OTP
          </button>
        </section>
      ) : null}

      {step === 'otp' ? (
        <section style={{ flex: 1 }}>
          <h2 className="hk-form-title">Enter the 6-digit code</h2>
          <p className="hk-form-help">
            Sent to <strong>{formattedPhone}</strong>.{' '}
            <button
              type="button"
              style={{ border: 0, background: 'transparent', color: '#1DA888', fontWeight: 600 }}
              onClick={() => {
                setOtp('');
                setStep('phone');
              }}
            >
              Change number
            </button>
          </p>
          <PinInput label="One-time code" length={6} masked={false} value={otp} onChange={setOtp} />
          <p className="hk-pin-status live">Auto-submits on 4th digit</p>
          {process.env.NODE_ENV !== 'production' ? (
            <p style={{ fontSize: 12, color: '#5C7170', marginTop: 8 }}>Dev: use 987654</p>
          ) : null}
        </section>
      ) : null}

      {step === 'set-pin' ? (
        <section style={{ flex: 1 }}>
          <h2 className="hk-form-title">Create your 4-digit PIN</h2>
          <p className="hk-form-help">Enter and confirm your PIN. You&apos;ll use it to sign in faster next time.</p>
          <PinInput label="New PIN" value={newPin} onChange={setNewPin} />
          <div style={{ height: 16 }} />
          <PinInput
            key={newPin.length >= 4 ? 'confirm-focus' : 'confirm-idle'}
            label="Confirm PIN"
            value={confirmPin}
            onChange={setConfirmPin}
            autoFocus={newPin.length >= 4}
          />
          <p className="hk-pin-status">Both fields must match · saves when confirm is complete</p>
          <button type="button" className="hk-cta" style={{ marginTop: 8 }} disabled={!pinsMatch || submitting} onClick={() => void savePin()}>
            Save PIN &amp; continue
          </button>
          <button
            type="button"
            className="hk-cta hk-cta-secondary"
            style={{ marginTop: 8 }}
            disabled={submitting}
            onClick={() => void skipPinSetup()}
          >
            Skip for now
          </button>
        </section>
      ) : null}

      {error ? <p className="hk-error">{error}</p> : null}
      <footer className="hk-foot">v1.0 · India only</footer>
    </main>
  );
}
