'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type PropertyOption = {
  propertyId: string;
  propertyName: string;
  role: string;
};

type VerifySuccess =
  | { status: 'OK'; userId: string; defaultPropertyId: string; properties?: undefined; hasPin?: boolean }
  | { status: 'OK'; userId: string; properties: PropertyOption[]; defaultPropertyId?: undefined; hasPin?: boolean }
  | { status: 'NEW_USER' }
  | { status: 'NO_PROPERTY'; userId: string; hasPin?: boolean }
  // Back-compat for PIN endpoint which still returns the old shape.
  | { userId: string; defaultPropertyId: string; properties?: undefined; hasPin?: boolean; status?: undefined }
  | { userId: string; properties: PropertyOption[]; defaultPropertyId?: undefined; hasPin?: boolean; status?: undefined };

type VerifyError = { code: string; message: string };

type Mode = 'idle' | 'otp' | 'pin' | 'name-capture' | 'select-property';

const CODE_LENGTH = 6;

function normalizePhone(digitsOnly: string) {
  return digitsOnly ? `+91${digitsOnly}` : '';
}

function displayPhone(digits: string) {
  if (digits.length !== 10) return digits;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function sessionStorageKey(phone: string) {
  return `gojo:otp-session:${phone}`;
}

const DEVICE_HINT_KEY = 'gojo:signin:device';
const DEVICE_HINT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type DeviceHint = { phone: string; hasPin: boolean; ts: number };

function readDeviceHint(): DeviceHint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceHint;
    if (!parsed.phone || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > DEVICE_HINT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDeviceHint(phone: string, hasPin: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      DEVICE_HINT_KEY,
      JSON.stringify({ phone, hasPin, ts: Date.now() } satisfies DeviceHint),
    );
  } catch {
    /* ignore quota errors */
  }
}

function clearDeviceHint() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DEVICE_HINT_KEY);
  } catch {
    /* ignore */
  }
}

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [codeDigits, setCodeDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectingPropertyId, setSelectingPropertyId] = useState<string | null>(null);
  const [postLoginHasPin, setPostLoginHasPin] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const normalizedPhone = useMemo(() => normalizePhone(phoneDigits), [phoneDigits]);
  const phoneReady = phoneDigits.length === 10;

  useEffect(() => {
    if (typeof window === 'undefined' || !phoneReady) return;
    const existing = window.sessionStorage.getItem(sessionStorageKey(normalizedPhone));
    if (existing) setSessionId(existing);
  }, [normalizedPhone, phoneReady]);

  useEffect(() => {
    const hint = readDeviceHint();
    if (!hint?.hasPin) return;
    const localDigits = hint.phone.startsWith('+91') ? hint.phone.slice(3) : hint.phone;
    if (localDigits.length !== 10) return;
    setPhoneDigits(localDigits);
    setInfo('Welcome back — enter your PIN to continue.');
    void startPinForPhone(`+91${localDigits}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === 'otp' || mode === 'pin') {
      codeInputRefs.current[0]?.focus();
    }
  }, [mode]);

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phoneReady) {
      setError('Enter a valid 10-digit mobile number.');
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
    setMode('otp');
    setCodeDigits(Array(CODE_LENGTH).fill(''));
    setInfo(
      payload.reusedExistingSession
        ? 'A recent code is still active for this number.'
        : 'Code sent. In local development, use 987654.',
    );
  }

  async function startPinForPhone(phone: string) {
    setSubmitting(true);
    setError(null);

    const response = await fetch('/api/auth/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.message ?? 'Unable to look up that number.');
      return;
    }
    if (!payload.registered) {
      clearDeviceHint();
      setError('No account found for this number. Use OTP to sign in.');
      return;
    }
    if (!payload.hasPin) {
      clearDeviceHint();
      setError('No PIN is set for this account. Use OTP to sign in.');
      return;
    }

    setMode('pin');
    setCodeDigits(Array(CODE_LENGTH).fill(''));
  }

  async function startPin() {
    if (!phoneReady) {
      setError('Enter a valid 10-digit mobile number first.');
      return;
    }
    setInfo(null);
    await startPinForPhone(normalizedPhone);
  }

  async function verifyOtp(code: string) {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    setInfo(null);

    const response = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId, otp: code }),
    });
    const payload = (await response.json()) as VerifySuccess | VerifyError;
    setVerifying(false);

    if (!response.ok) {
      setError('message' in payload ? payload.message : 'Unable to verify code.');
      setCodeDigits(Array(CODE_LENGTH).fill(''));
      codeInputRefs.current[0]?.focus();
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(sessionStorageKey(normalizedPhone));
    }

    // Hotfix 2 Phase A: three-branch response.
    const status = 'status' in payload ? payload.status : undefined;
    if (status === 'NEW_USER') {
      setMode('name-capture');
      setNameInput('');
      return;
    }
    if (status === 'NO_PROPERTY') {
      router.push('/onboarding/create-property');
      router.refresh();
      return;
    }

    writeDeviceHint(normalizedPhone, false);
    const hasPin = 'hasPin' in payload ? Boolean(payload.hasPin) : true;
    setPostLoginHasPin(hasPin);

    if ('properties' in payload && payload.properties && payload.properties.length > 1) {
      setProperties(payload.properties);
      setMode('select-property');
      return;
    }

    const dest = hasPin ? '/dashboard' : '/set-pin';
    router.push(dest);
    router.refresh();
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/auth/complete-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: trimmed }),
    });
    const payload = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(payload.message ?? 'Could not save your name. Please try again.');
      return;
    }
    router.push('/onboarding/create-property');
    router.refresh();
  }

  async function verifyPin(pin: string) {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    setInfo(null);

    const response = await fetch('/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone: normalizedPhone, pin }),
    });
    const payload = (await response.json()) as VerifySuccess | VerifyError;
    setVerifying(false);

    if (!response.ok) {
      setError('message' in payload ? payload.message : 'Unable to verify PIN.');
      setCodeDigits(Array(CODE_LENGTH).fill(''));
      codeInputRefs.current[0]?.focus();
      return;
    }

    writeDeviceHint(normalizedPhone, true);

    if ('properties' in payload && payload.properties && payload.properties.length > 1) {
      setProperties(payload.properties);
      setMode('select-property');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  function handleCodeChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setCodeDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      const joined = next.join('');
      if (digit && index < CODE_LENGTH - 1) {
        codeInputRefs.current[index + 1]?.focus();
      }
      if (joined.length === CODE_LENGTH && next.every((d) => d !== '')) {
        if (mode === 'otp') void verifyOtp(joined);
        else if (mode === 'pin') void verifyPin(joined);
      }
      return next;
    });
  }

  function handleCodeKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !codeDigits[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(CODE_LENGTH).fill('').map((_, i) => pasted[i] ?? '');
    setCodeDigits(next);
    const lastIndex = Math.min(pasted.length, CODE_LENGTH) - 1;
    codeInputRefs.current[lastIndex]?.focus();
    if (pasted.length === CODE_LENGTH) {
      if (mode === 'otp') void verifyOtp(pasted);
      else if (mode === 'pin') void verifyPin(pasted);
    }
  }

  function resetToPhone() {
    setMode('idle');
    setCodeDigits(Array(CODE_LENGTH).fill(''));
    setSessionId('');
    setError(null);
    setInfo(null);
    if (typeof window !== 'undefined' && normalizedPhone) {
      window.sessionStorage.removeItem(sessionStorageKey(normalizedPhone));
    }
  }

  function switchToOtpFromPin() {
    setMode('idle');
    setCodeDigits(Array(CODE_LENGTH).fill(''));
    setError(null);
    setInfo('Choose Get OTP to receive a fresh code.');
  }

  async function selectProperty(propertyId: string) {
    if (selectingPropertyId) return;
    setSelectingPropertyId(propertyId);
    setError(null);

    const response = await fetch('/api/auth/select-property', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ propertyId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.message ?? 'Unable to select that property.');
      setSelectingPropertyId(null);
      return;
    }

    const dest = postLoginHasPin ? '/dashboard' : '/set-pin';
    router.push(dest);
    router.refresh();
  }

  const heading =
    mode === 'select-property'
      ? 'Choose a property'
      : mode === 'pin'
        ? 'Enter your PIN'
        : mode === 'name-capture'
          ? "Let's set up your account"
          : 'Sign in';

  const subtitle =
    mode === 'select-property'
      ? 'You have access to multiple properties.'
      : mode === 'otp'
        ? `Enter the 6-digit code we sent to ${displayPhone(phoneDigits)}.`
        : mode === 'pin'
          ? `Enter your 4-digit PIN for ${displayPhone(phoneDigits)}.`
          : mode === 'name-capture'
            ? 'We did not find an account with your number. How should I address you?'
            : 'Enter your phone number to get started.';

  return (
    <div className="signin-screen">
      <aside className="signin-hero">
        <div className="signin-hero-logo">Gojo</div>
        <div className="signin-hero-tag">HOSPITALITY, SIMPLIFIED</div>
        <h2>Manage your property with confidence</h2>
        <p>Reservations, housekeeping, revenue and guest communications — in one calm, intuitive surface.</p>
      </aside>

      <main className="signin-pane">
        <div className="signin-card">
          <h3>{heading}</h3>
          <p className="signin-subtitle">{subtitle}</p>

          {mode === 'name-capture' ? (
            <form className="signin-form" onSubmit={submitName}>
              <label htmlFor="signupNameInput" style={{ position: 'relative', display: 'block' }}>
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 10,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: '#9EAEAC',
                    textTransform: 'uppercase',
                    pointerEvents: 'none',
                  }}
                >
                  Name
                </span>
                <input
                  id="signupNameInput"
                  type="text"
                  autoFocus
                  maxLength={80}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name"
                  style={{
                    width: '100%',
                    padding: '24px 14px 12px',
                    fontSize: 16,
                    border: '1px solid #D9E5E3',
                    borderRadius: 8,
                    outline: 'none',
                  }}
                />
              </label>
              <div className="signin-btn-group" style={{ marginTop: 16 }}>
                <button
                  type="submit"
                  className="signin-btn signin-btn-primary"
                  disabled={submitting || nameInput.trim().length === 0}
                >
                  {submitting ? 'Saving…' : 'Continue →'}
                </button>
              </div>
              {error ? <div className="signin-error">{error}</div> : null}
            </form>
          ) : mode === 'select-property' ? (
            <div className="signin-prop-selector">
              <span className="signin-section-label">Properties</span>
              <ul className="signin-prop-list">
                {properties.map((p) => {
                  const isSelecting = selectingPropertyId === p.propertyId;
                  return (
                    <li key={p.propertyId}>
                      <button
                        type="button"
                        className={`signin-prop-opt${isSelecting ? ' is-selecting' : ''}`}
                        onClick={() => selectProperty(p.propertyId)}
                        disabled={selectingPropertyId !== null}
                      >
                        <span className="signin-prop-radio" aria-hidden="true" />
                        <span className="signin-prop-name">{p.propertyName}</span>
                        <span className="signin-prop-meta">{p.role}{isSelecting ? ' · Opening…' : ''}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <form className="signin-form" onSubmit={requestOtp}>
              <label htmlFor="phoneLocalInput">Phone number</label>
              <div className="signin-phone-row">
                <div className="signin-prefix" aria-hidden="true">+91</div>
                <input
                  id="phoneLocalInput"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  maxLength={10}
                  value={phoneDigits}
                  disabled={mode === 'otp' || mode === 'pin'}
                  onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
              {mode === 'idle' ? (
                <div className="signin-helper">We&apos;ll send a 6-digit code to this number.</div>
              ) : null}

              {mode === 'otp' || mode === 'pin' ? (
                <div className="signin-otp-pin">
                  <span className="signin-section-label">
                    {mode === 'pin' ? 'PIN' : 'Verification code'}
                  </span>
                  <div className={`signin-digits${verifying ? ' is-verifying' : ''}`} role="group" aria-label={mode === 'pin' ? '4-digit PIN' : '6-digit verification code'}>
                    {codeDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          codeInputRefs.current[index] = el;
                        }}
                        type={mode === 'pin' ? 'password' : 'text'}
                        inputMode="numeric"
                        autoComplete={mode === 'pin' ? 'current-password' : index === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        value={digit}
                        disabled={verifying}
                        aria-label={`Digit ${index + 1}`}
                        className={`signin-digit${digit ? ' is-filled' : ''}`}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        onPaste={index === 0 ? handleCodePaste : undefined}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    ))}
                  </div>
                  <div className="signin-otp-helper">
                    {verifying ? (
                      <span className="signin-inline-verify"><span className="signin-spinner-dark" />Verifying…</span>
                    ) : (
                      'Auto-submits on the 6th digit.'
                    )}
                  </div>
                </div>
              ) : null}

              <div className="signin-btn-group">
                {mode === 'idle' ? (
                  <>
                    <button
                      type="submit"
                      className="signin-btn signin-btn-primary"
                      disabled={submitting || !phoneReady}
                    >
                      {submitting ? 'Sending code…' : 'Get OTP'}
                    </button>
                    <div className="signin-link-row">
                      or{' '}
                      <a
                        role="button"
                        tabIndex={0}
                        aria-disabled={!phoneReady || submitting}
                        onClick={() => {
                          if (!phoneReady || submitting) return;
                          void startPin();
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && phoneReady && !submitting) {
                            e.preventDefault();
                            void startPin();
                          }
                        }}
                      >
                        Login with PIN
                      </a>
                    </div>
                  </>
                ) : mode === 'pin' ? (
                  <>
                    <button
                      type="button"
                      className="signin-btn signin-btn-secondary"
                      onClick={resetToPhone}
                      disabled={verifying}
                    >
                      Change number
                    </button>
                    <div className="signin-link-row">
                      Forgot PIN?{' '}
                      <a
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (verifying) return;
                          switchToOtpFromPin();
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !verifying) {
                            e.preventDefault();
                            switchToOtpFromPin();
                          }
                        }}
                      >
                        Login with OTP
                      </a>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="signin-btn signin-btn-secondary"
                    onClick={resetToPhone}
                    disabled={verifying}
                  >
                    Change number
                  </button>
                )}
              </div>
            </form>
          )}

          {info ? <div className="signin-dev-note">{info}</div> : null}
          {error ? <div className="signin-err-msg">{error}</div> : null}
        </div>
      </main>
    </div>
  );
}
