// Story 10.3 AC5: Full-screen suspension notice rendered for SUSPENDED
// subscriptions. Replaces app content entirely; only the Reactivate CTA
// + a "contact support" affordance are reachable.

import React from 'react';

import { buildUpgradeUrl } from '@gojo/types';

export interface SuspensionNoticeProps {
  propertyId: string;
  propertyName?: string | null;
}

export function SuspensionNotice({ propertyId, propertyName }: SuspensionNoticeProps): React.ReactElement {
  const conversionUrl = buildUpgradeUrl(propertyId);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F9F8] px-6 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-[#B8DDD5] bg-white p-10 text-center shadow-[0_2px_12px_rgba(26,43,46,0.06)]">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#FDF5F0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.6px] text-[#B5572A]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B5572A]" />
          Account suspended
        </div>
        <h1 className="mb-3 text-2xl font-bold text-[#1A2B2E]">
          {propertyName ? `${propertyName} is on hold` : 'Your account is on hold'}
        </h1>
        <p className="mx-auto mb-8 max-w-md text-sm leading-[1.6] text-[#5C7170]">
          Your trial ended and the grace period has passed, so Gojo paused all activity for this
          property. Pick a plan to bring everything back online — your data is safe and your
          configuration is exactly as you left it.
        </p>
        <a
          href={conversionUrl}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1DA888] px-6 py-3 text-sm font-semibold text-white shadow-[0_2px_4px_rgba(29,168,136,0.25)] transition hover:bg-[#0E7C7B] active:translate-y-px"
        >
          Reactivate
          <span aria-hidden className="text-base leading-none">→</span>
        </a>
        <div className="mt-6 text-[12px] text-[#5C7170]">
          Need help? Email{' '}
          <a href="mailto:support@gojo.in" className="text-[#0E7C7B] underline">
            support@gojo.in
          </a>
        </div>
      </div>
    </div>
  );
}
