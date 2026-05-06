'use client';

import { useEffect, useRef } from 'react';

import { BaseCard } from '@/components/ui/base-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatInr } from '@/lib/utils/currency';

export function BelowFloorModal({
  enteredRate,
  floorRate,
  delta,
  onConfirm,
  onCancel,
}: {
  enteredRate: number;
  floorRate: number;
  delta: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,33,28,0.42)] px-4" onClick={onCancel}>
      <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
        <BaseCard title="Rate Below Floor" className="shadow-[0_18px_48px_rgba(16,33,28,0.18)]">
          <div role="alertdialog" aria-modal="true" className="space-y-4 text-[13px] text-[var(--color-charcoal)]">
            <p>
              You entered <strong>{formatInr(enteredRate)}</strong>, which is{' '}
              <strong>{formatInr(delta)} below</strong> the floor rate of <strong>{formatInr(floorRate)}</strong>.
            </p>
            <p className="text-[12px] text-[var(--color-mid-gray)]">
              This override will be recorded in the audit log.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={onCancel}>
                Go back
              </Button>
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirm}
                className={cn(
                  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] px-4 py-2 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]',
                  'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)]',
                )}
              >
                Confirm Override
              </button>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>
  );
}
