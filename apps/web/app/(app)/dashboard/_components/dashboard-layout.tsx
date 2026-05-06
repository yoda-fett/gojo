'use client';

import { useMemo, type ReactNode } from 'react';

import { DataFreshnessIndicator } from '@/components/dashboard/data-freshness-indicator';
import { PeriodToggle } from '@/components/dashboard/period-toggle';
import { Topbar } from '@/components/layout/topbar';
import type { DateRange } from '@/lib/dashboard/date-range';
import { useRefreshContext } from '@/lib/contexts/refresh-context';

export function DashboardShell({ children, range, onRangeChange }: { children: ReactNode; range: DateRange; onRangeChange: (range: DateRange) => void }) {
  const { lastPollAt, isFailing } = useRefreshContext();

  const controls = useMemo(
    () => (
      <>
        <DataFreshnessIndicator lastPollAt={lastPollAt} isFailing={isFailing} />
        <PeriodToggle value={range} onChange={onRangeChange} />
      </>
    ),
    [isFailing, lastPollAt, onRangeChange, range],
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-off-white)]">
      <Topbar title="Dashboard" controls={controls} />
      <div className="px-4 py-[28px] sm:px-8">{children}</div>
    </div>
  );
}
