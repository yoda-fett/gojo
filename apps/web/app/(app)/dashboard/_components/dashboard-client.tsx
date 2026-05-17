'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ArrivalsMiniList } from '@/components/dashboard/arrivals-mini-list';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SavingsCardNudge } from '@/components/dashboard/savings-card-nudge';
import { ErrorMessage } from '@/components/ui/error-message';
import { formatInr, formatPercentValue } from '@/lib/format';
import { buildRange, type RangePreset } from '@/lib/dashboard/date-range';
import { RefreshProvider } from '@/lib/contexts/refresh-context';

import { AlertPanel } from './alert-panel';
import { DirectBookingCard } from './direct-booking-card';
import { ChartPanel } from './chart-panel';
import { DashboardShell } from './dashboard-layout';
import { Refresher } from '../Refresher';
import { NoArrivalsEmptyState } from '../_empty-states/no-arrivals';

type Trend = {
  direction: 'up' | 'down' | 'flat';
  pct: number;
};

type KpiResponse = {
  occupancyRate: number;
  revenueToday?: number;
  arrivalsToday: number;
  departuresToday: number;
  sparklines: Record<string, number[]>;
  trends: Record<string, Trend>;
};

type Arrival = {
  bookingRef: string;
  guestName: string;
  roomType: string;
  checkInTime: string;
  status: string;
};

type DashboardSnapshot = {
  kpis: KpiResponse;
  arrivals: Arrival[];
};

function money(value: number) {
  return formatInr(value);
}

function cardProps(base: { label: string; value: string | number; drilldownHref?: string }, trend: Trend | undefined, sparkline: number[] | undefined) {
  return {
    ...base,
    ...(trend ? { trend: { ...trend, label: 'vs last period' as const } } : {}),
    ...(sparkline ? { sparkline } : {}),
  };
}

export function DashboardClient({ propertyId, role, initial, savingsCard }: { propertyId: string; role: 'OWNER' | 'MANAGER' | 'FRONT_DESK' | 'HOUSEKEEPING'; initial: DashboardSnapshot; savingsCard?: import('@/lib/dashboard/savings-card').SavingsCardSnapshot | null }) {
  const [range, setRange] = useState(buildRange('7d'));
  const kpis = useQuery({
    queryKey: ['dashboard-kpis', propertyId, range.from, range.to],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/kpis?from=${range.from}&to=${range.to}`);
      if (!response.ok) throw new Error('Unable to load dashboard KPIs');
      return (await response.json()) as KpiResponse;
    },
    initialData: initial.kpis,
  });
  const arrivals = useQuery({
    queryKey: ['dashboard-arrivals', propertyId, range.from, range.to],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/arrivals?date=${range.to}`);
      if (!response.ok) throw new Error('Unable to load arrivals');
      return (await response.json()) as Arrival[];
    },
    initialData: initial.arrivals,
  });
  const roomsAttention = useQuery({
    queryKey: ['rooms-needing-attention', propertyId],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/rooms-needing-attention');
      if (!response.ok) throw new Error('Unable to load rooms needing attention');
      return (await response.json()) as { count: number };
    },
    refetchInterval: 30_000,
  });

  return (
    <RefreshProvider>
      <DashboardShell range={range} onRangeChange={setRange}>
        <Refresher />
        {kpis.isError ? <ErrorMessage line1="Dashboard KPIs are unavailable" line2="Gojo is retrying in the background" line3="Please try again in a moment" /> : null}
        <section className={`grid gap-4 ${role === 'FRONT_DESK' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-5'}`}>
          {kpis.isLoading ? (
            Array.from({ length: role === 'FRONT_DESK' ? 3 : 5 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-[12px] border border-transparent bg-white p-5 shadow-[0_1px_3px_rgba(26,43,46,0.05)]">
                <div className="h-3 w-24 rounded-full bg-black/5" />
                <div className="mt-4 h-9 w-20 rounded-md bg-black/10" />
                <div className="mt-3 h-4 w-28 rounded-full bg-black/5" />
                <div className="mt-3 h-7 w-full rounded-md bg-black/5" />
              </div>
            ))
          ) : (
            <>
              <KpiCard {...cardProps({ label: 'Occupancy Rate', value: formatPercentValue(kpis.data?.occupancyRate ?? 0), drilldownHref: '/reports/occupancy' }, kpis.data?.trends.occupancyRate, kpis.data?.sparklines.occupancyRate)} />
              {role !== 'FRONT_DESK' ? (
                <KpiCard
                  {...cardProps({ label: 'Revenue Today', value: money(kpis.data?.revenueToday ?? 0), drilldownHref: '/reports/revenue' }, kpis.data?.trends.revenueToday, kpis.data?.sparklines.revenueToday)}
                />
              ) : null}
              <KpiCard {...cardProps({ label: 'Arrivals Today', value: kpis.data?.arrivalsToday ?? 0 }, kpis.data?.trends.arrivalsToday, kpis.data?.sparklines.arrivalsToday)} />
              <KpiCard {...cardProps({ label: 'Departures Today', value: kpis.data?.departuresToday ?? 0 }, kpis.data?.trends.departuresToday, kpis.data?.sparklines.departuresToday)} />
              {role !== 'FRONT_DESK' ? (
                <KpiCard
                  label="Rooms Needing Attention"
                  value={roomsAttention.data?.count ?? 0}
                  alertState={(roomsAttention.data?.count ?? 0) > 0}
                  drilldownHref="/dashboard#alerts"
                  drilldownLabel="View alerts"
                />
              ) : null}
            </>
          )}
        </section>

        {savingsCard ? (
          <section className="mt-5">
            <SavingsCardNudge propertyId={propertyId} snapshot={savingsCard} />
          </section>
        ) : null}

        <section className="mt-5 flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_320px]">
          <ChartPanel range={range} onPresetChange={(preset: RangePreset) => setRange(buildRange(preset))} />
          <AlertPanel propertyId={propertyId} />
        </section>

        <section className="mt-5">
          <ArrivalsMiniList rows={arrivals.data ?? []} emptyState={<NoArrivalsEmptyState />} />
        </section>

        <section className="mt-5">
          <DirectBookingCard propertyId={propertyId} from={range.from} to={range.to} />
        </section>
      </DashboardShell>
    </RefreshProvider>
  );
}
