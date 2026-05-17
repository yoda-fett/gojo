// Story 10.2g: SavingsCard trial-conversion nudge.
// Wireframe: wireframes/owner-dashboard/30-savings-card-trial-nudge.html
//
// Standard variant (teal) when daysRemaining > 7; urgent variant (coral)
// otherwise. The card hides itself optimistically after a successful
// dismiss POST to /api/alerts/{id}/dismiss.

'use client';

import React, { useState } from 'react';

import { buildUpgradeUrl } from '@gojo/types';

import type { SavingsCardSnapshot } from '@/lib/dashboard/savings-card';

const URGENT_THRESHOLD_DAYS = 7;
const TRIAL_LENGTH_DAYS = 124;

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN').format(amount);
}

export interface SavingsCardNudgeProps {
  propertyId: string;
  snapshot: SavingsCardSnapshot;
}

export function SavingsCardNudge({ propertyId, snapshot }: SavingsCardNudgeProps): React.ReactElement | null {
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  const urgent = snapshot.daysRemaining <= URGENT_THRESHOLD_DAYS;
  const conversionUrl = buildUpgradeUrl(propertyId);

  const wrapperBase =
    'relative grid items-center gap-7 rounded-xl border bg-white p-6 shadow-[0_2px_6px_rgba(26,43,46,0.04)] grid-cols-[1fr_auto]';
  const wrapperVariant = urgent
    ? 'border-[#B8DDD5] border-l-4 border-l-[#E8763F] bg-gradient-to-r from-white to-[#FDF5F0]'
    : 'border-[#B8DDD5] border-l-4 border-l-[#1DA888] bg-gradient-to-r from-white to-[#F4FBF9]';

  const eyebrowText = urgent
    ? `Grace period · trial day ${snapshot.dayOffset} of ${TRIAL_LENGTH_DAYS}`
    : `Trial day ${snapshot.dayOffset} of ${TRIAL_LENGTH_DAYS}`;
  const eyebrowColor = urgent ? 'text-[#B5572A]' : 'text-[#1DA888]';
  const eyebrowDotBg = urgent ? 'bg-[#B5572A]' : 'bg-[#1DA888]';

  const figureColor = urgent ? 'text-[#B5572A]' : 'text-[#0E7C7B]';
  const currencyColor = urgent ? 'text-[#B5572A]' : 'text-[#1DA888]';
  const proofColor = urgent ? 'text-[#B5572A]' : 'text-[#0E7C7B]';

  const ctaLabel = urgent ? 'Choose a plan' : 'Convert to a paid plan';
  const ctaBg = urgent
    ? 'bg-[#E8763F] hover:bg-[#B5572A] shadow-[0_2px_4px_rgba(232,118,63,0.25)]'
    : 'bg-[#1DA888] hover:bg-[#0E7C7B] shadow-[0_2px_4px_rgba(29,168,136,0.25)]';

  const subCtaLabel = urgent ? (
    <>
      <strong className="text-[#B5572A]">{snapshot.daysRemaining} days</strong> until OTA pause
    </>
  ) : (
    <>{snapshot.daysRemaining} days left in your trial</>
  );

  const headlineText = urgent
    ? "You've saved this much by booking direct"
    : "You've saved on OTA commissions through Gojo so far";

  async function dismiss() {
    setDismissing(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${snapshot.alertId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data: { message?: string } = await res.json().catch(() => ({}));
        throw new Error(data.message || `Dismiss failed (${res.status})`);
      }
      setDismissed(true);
    } catch (e) {
      setError((e as Error).message);
      setDismissing(false);
    }
  }

  return (
    <section
      role="region"
      aria-label="Trial conversion savings"
      data-variant={urgent ? 'urgent' : 'standard'}
      className={`${wrapperBase} ${wrapperVariant}`}
    >
      <button
        type="button"
        aria-label="Dismiss savings card"
        onClick={dismiss}
        disabled={dismissing}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-[#5C7170] transition hover:bg-black/5 hover:text-[#1A2B2E] disabled:opacity-50"
      >
        ×
      </button>

      <div>
        <div className={`mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.6px] ${eyebrowColor}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${eyebrowDotBg}`} />
          {eyebrowText}
        </div>
        <div className="mb-1 text-sm text-[#5C7170]">{headlineText}</div>
        <div className="mb-2.5 flex items-baseline gap-2">
          <span className={`text-[38px] font-extrabold leading-none tracking-[-0.8px] ${figureColor}`}>
            <span className={`mr-0.5 text-[24px] font-bold ${currencyColor}`}>₹</span>
            {formatINR(snapshot.savingsAmount)}
          </span>
          <span className="text-[13px] font-medium text-[#5C7170]">in this trial</span>
        </div>
        <p className="max-w-[540px] text-[13px] leading-[1.55] text-[#1A2B2E]">
          {urgent ? (
            <>
              Your trial ends in <strong className={proofColor}>{snapshot.daysRemaining} days</strong>. After
              that, your OTA channels pause until you pick a plan — and the saved commissions stop counting.
            </>
          ) : (
            <>
              <span className="mr-1 text-[#5C7170] line-through decoration-[#E8763F] decoration-2">
                ₹{formatINR(snapshot.savingsAmount)} in OTA commissions
              </span>
              stayed in your pocket{' '}
              {snapshot.directBookingCount > 0 ? (
                <>
                  from <strong className={proofColor}>{snapshot.directBookingCount} direct bookings</strong>.
                </>
              ) : (
                <>through direct bookings.</>
              )}{' '}
              Convert to a paid plan and keep that savings going every month.
            </>
          )}
        </p>
        {error ? (
          <div role="alert" className="mt-2 text-xs text-rose-600">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-[220px] flex-col items-stretch gap-2">
        <a
          href={conversionUrl}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-3 text-sm font-semibold text-white transition active:translate-y-px ${ctaBg}`}
        >
          {ctaLabel}
          <span aria-hidden className="text-base leading-none">→</span>
        </a>
        <div className="text-center text-[11px] text-[#5C7170]">{subCtaLabel}</div>
      </div>
    </section>
  );
}
