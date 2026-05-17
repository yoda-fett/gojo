'use client';

import { useEffect, useId, useRef } from 'react';

type PinInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  masked?: boolean;
  autoFocus?: boolean;
  label?: string;
};

export function PinInput({
  length = 4,
  value,
  onChange,
  masked = true,
  autoFocus = true,
  label,
}: PinInputProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const filled = value.length;
  const isPinLayout = length === 4;

  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [autoFocus, length]);

  return (
    <div style={{ position: 'relative' }}>
      {label ? <span className="hk-label">{label}</span> : null}
      <div
        className={isPinLayout ? 'hk-otp-row pin' : 'hk-otp-row'}
        onClick={() => inputRef.current?.focus()}
        role="presentation"
      >
        {digits.map((digit, index) => {
          const isFilled = index < filled;
          const isActive = index === filled;
          const cellClass = isPinLayout ? 'hk-otp-cell pin-cell' : 'hk-otp-cell';
          return (
            <div
              key={index}
              className={`${cellClass}${isFilled ? ' filled' : ''}${isActive ? ' active' : ''}`}
            >
              {isActive && !isFilled ? (
                <span className="hk-otp-caret" aria-hidden />
              ) : isFilled ? (
                masked ? '●' : digit.trim() || ''
              ) : null}
            </div>
          );
        })}
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        autoComplete={masked ? 'one-time-code' : 'off'}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, length))}
        aria-label={label ?? (masked ? 'PIN' : 'One-time code')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          border: 0,
          padding: 0,
          margin: 0,
          cursor: 'text',
        }}
      />
      {isPinLayout ? (
        <div className="hk-pin-progress">
          <span style={{ width: `${(filled / length) * 100}%` }} />
        </div>
      ) : null}
    </div>
  );
}
