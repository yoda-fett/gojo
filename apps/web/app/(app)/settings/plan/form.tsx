// @ts-nocheck
'use client';

import React, { useMemo, useState } from 'react';

import { TIER_RANK, isDowngrade, type Tier } from '@gojo/types';

interface Blocker {
  feature: 'ota_channels' | 'direct_booking' | 'rate_override_below_floor';
  reason: string;
  action: string;
}

interface SubscriptionView {
  tier: Tier;
  status: string;
  billingCadence: 'MONTHLY' | 'ANNUAL';
  currentPeriodEnd: string | null;
  pendingDowngradeTier: 'STARTER' | 'GROWTH' | null;
  pendingDowngradeAt: string | null;
}

const TIER_LABELS: Record<Tier, string> = {
  TRIAL: 'Trial',
  STARTER: 'Starter',
  GROWTH: 'Growth',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function PlanManagementForm({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: SubscriptionView | null;
}) {
  const [sub, setSub] = useState<SubscriptionView | null>(initial);
  const [targetTier, setTargetTier] = useState<Tier | ''>('');
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downgradeTargets = useMemo<Tier[]>(() => {
    if (!sub) return [];
    return (Object.keys(TIER_RANK) as Tier[]).filter(
      (t) => t !== 'TRIAL' && isDowngrade(sub.tier, t),
    );
  }, [sub]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  async function refresh() {
    const res = await fetch('/api/subscriptions/downgrade');
    if (!res.ok) return;
    const data = (await res.json()) as { subscription: SubscriptionView | null };
    setSub(data.subscription);
  }

  async function onSchedule() {
    if (!targetTier) return;
    setBusy(true);
    setBlockers([]);
    setError(null);
    try {
      const res = await fetch('/api/subscriptions/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data?.code === 'CONTACT_SUPPORT_REQUIRED') {
        setError(data.message ?? 'Annual plan downgrades require support.');
        return;
      }
      if (res.status === 422 && data?.code === 'DOWNGRADE_BLOCKED') {
        setBlockers(data.blockers ?? []);
        return;
      }
      if (!res.ok) {
        setError(data?.message || `Could not schedule downgrade (${res.status})`);
        return;
      }
      showToast(`Downgrade to ${TIER_LABELS[targetTier]} scheduled.`);
      await refresh();
      setTargetTier('');
    } finally {
      setBusy(false);
    }
  }

  async function onCancelPending() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/subscriptions/downgrade', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || `Could not cancel (${res.status})`);
        return;
      }
      showToast('Pending downgrade cancelled.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!sub) {
    return (
      <section className="mt-6 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No subscription found for this property.
      </section>
    );
  }

  const annual = sub.billingCadence === 'ANNUAL';
  const hasPending = Boolean(sub.pendingDowngradeTier);

  return (
    <section aria-label="Plan management" className="mt-6 space-y-5">
      <div className="rounded-lg border border-[#B8DDD5] bg-white p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5C7170]">
          Current plan
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <div className="text-2xl font-bold text-[#0E7C7B]">{TIER_LABELS[sub.tier]}</div>
          <div className="text-xs text-[#5C7170]">
            {sub.billingCadence === 'MONTHLY' ? 'Monthly billing' : 'Annual billing'} ·{' '}
            {sub.status.toLowerCase()}
          </div>
        </div>
        <div className="mt-3 text-xs text-[#5C7170]">
          Next billing date: <strong className="text-[#1A2B2E]">{formatDate(sub.currentPeriodEnd)}</strong>
        </div>
      </div>

      {hasPending ? (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <div>
            Downgrade to <strong>{TIER_LABELS[sub.pendingDowngradeTier as Tier]}</strong>{' '}
            scheduled for <strong>{formatDate(sub.pendingDowngradeAt)}</strong>.
          </div>
          <button
            type="button"
            onClick={onCancelPending}
            disabled={busy}
            className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            Cancel downgrade
          </button>
        </div>
      ) : annual ? (
        <div
          role="status"
          className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
        >
          Annual plans are downgraded by our team. Email{' '}
          <a className="text-[#0E7C7B] underline" href="mailto:support@gojo.in?subject=Plan%20downgrade">
            support@gojo.in
          </a>
          {' '}with your request.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5C7170]">
            Schedule a downgrade
          </div>
          <p className="mt-1 text-xs text-[#5C7170]">
            The change takes effect at the end of your current billing cycle on{' '}
            <strong>{formatDate(sub.currentPeriodEnd)}</strong>.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="target-tier" className="text-xs text-[#5C7170]">
              Downgrade to
            </label>
            <select
              id="target-tier"
              value={targetTier}
              onChange={(e) => setTargetTier(e.target.value as Tier)}
              disabled={busy || downgradeTargets.length === 0}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="">Select tier…</option>
              {downgradeTargets.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSchedule}
              disabled={busy || !targetTier}
              className="rounded-md bg-[#1DA888] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0E7C7B] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? 'Working…' : 'Schedule downgrade'}
            </button>
          </div>

          {downgradeTargets.length === 0 ? (
            <p className="mt-2 text-xs text-[#5C7170]">No lower tier available from your current plan.</p>
          ) : null}

          {blockers.length > 0 ? (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.5px] text-rose-700">
                Resolve before downgrading
              </div>
              <ul role="list" className="mt-2 space-y-2">
                {blockers.map((b) => (
                  <li
                    key={b.feature}
                    className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
                  >
                    <div className="font-medium">{b.reason}</div>
                    <div className="text-xs text-rose-700">{b.action}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <div role="alert" className="text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      {toast ? (
        <div role="status" className="text-sm text-emerald-700">
          {toast}
        </div>
      ) : null}

      <div className="text-[11px] text-[#9EAEAC]">propertyId: {propertyId}</div>
    </section>
  );
}
