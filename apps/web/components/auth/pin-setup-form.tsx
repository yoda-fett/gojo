'use client';

import { useEffect, useRef, useState } from 'react';

const LEN = 4;

type Props = {
  submitting: boolean;
  error: string | null;
  onSubmit: (pin: string) => void | Promise<void>;
  onSkip?: () => void;
  skipLabel?: string;
  submitLabel?: string;
};

export function PinSetupForm({ submitting, error, onSubmit, onSkip, skipLabel, submitLabel }: Props) {
  const [newPin, setNewPin] = useState<string[]>(() => Array(LEN).fill(''));
  const [confirmPin, setConfirmPin] = useState<string[]>(() => Array(LEN).fill(''));
  const [localErr, setLocalErr] = useState<string | null>(null);
  const newRefs = useRef<Array<HTMLInputElement | null>>([]);
  const confRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    newRefs.current[0]?.focus();
  }, []);

  function setDigit(
    list: string[],
    setList: (v: string[]) => void,
    refs: React.MutableRefObject<Array<HTMLInputElement | null>>,
    index: number,
    raw: string,
    onComplete: (joined: string) => void,
  ) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...list];
    next[index] = digit;
    setList(next);
    if (digit && index < LEN - 1) refs.current[index + 1]?.focus();
    const joined = next.join('');
    if (joined.length === LEN && next.every((d) => d !== '')) {
      onComplete(joined);
    }
  }

  function tryConfirm(joined: string) {
    setLocalErr(null);
    const newJoined = newPin.join('');
    if (newJoined.length !== LEN) return;
    if (joined !== newJoined) {
      setLocalErr('PINs do not match.');
      setConfirmPin(Array(LEN).fill(''));
      confRefs.current[0]?.focus();
      return;
    }
    void onSubmit(joined);
  }

  function onNewComplete(joined: string) {
    setLocalErr(null);
    confRefs.current[0]?.focus();
    if (confirmPin.join('').length === LEN) {
      tryConfirm(confirmPin.join(''));
    }
  }

  const display = error ?? localErr;

  return (
    <div className="signin-form">
      <div className="signin-otp-pin">
        <span className="signin-section-label">New PIN</span>
        <div className="signin-digits" role="group" aria-label="New 4-digit PIN">
          {newPin.map((d, i) => (
            <input
              key={i}
              ref={(el) => { newRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={1}
              value={d}
              disabled={submitting}
              aria-label={`New PIN digit ${i + 1}`}
              className={`signin-digit${d ? ' is-filled' : ''}`}
              onChange={(e) => setDigit(newPin, setNewPin, newRefs, i, e.target.value, onNewComplete)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !newPin[i] && i > 0) newRefs.current[i - 1]?.focus();
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
          ))}
        </div>
      </div>

      <div className="signin-otp-pin">
        <span className="signin-section-label">Confirm PIN</span>
        <div className={`signin-digits${submitting ? ' is-verifying' : ''}`} role="group" aria-label="Confirm 4-digit PIN">
          {confirmPin.map((d, i) => (
            <input
              key={i}
              ref={(el) => { confRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={1}
              value={d}
              disabled={submitting}
              aria-label={`Confirm PIN digit ${i + 1}`}
              className={`signin-digit${d ? ' is-filled' : ''}`}
              onChange={(e) => setDigit(confirmPin, setConfirmPin, confRefs, i, e.target.value, tryConfirm)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !confirmPin[i] && i > 0) confRefs.current[i - 1]?.focus();
              }}
              onFocus={(e) => e.currentTarget.select()}
            />
          ))}
        </div>
        <div className="signin-otp-helper">
          {submitting ? 'Saving…' : 'Auto-submits when both PINs match.'}
        </div>
      </div>

      {display ? <div className="signin-err-msg">{display}</div> : null}

      <div className="signin-btn-group">
        {submitLabel ? (
          <button
            type="button"
            className="signin-btn signin-btn-primary"
            disabled={submitting || newPin.join('').length !== LEN || confirmPin.join('').length !== LEN}
            onClick={() => tryConfirm(confirmPin.join(''))}
          >
            {submitting ? 'Saving…' : submitLabel}
          </button>
        ) : null}
        {onSkip ? (
          <button type="button" className="signin-btn signin-btn-secondary" onClick={onSkip} disabled={submitting}>
            {skipLabel ?? 'Skip'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
