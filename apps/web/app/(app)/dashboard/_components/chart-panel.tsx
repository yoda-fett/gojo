'use client';

import { useQuery } from '@tanstack/react-query';

import { OccupancyRevenueChart } from '@/components/charts/occupancy-revenue-chart';
import { ChartSkeleton } from '@/components/charts/chart-skeleton';
import { ReportCard } from '@/components/reports/report-card';
import { ErrorMessage } from '@/components/ui/error-message';
import { chartXLabelControls } from '@/lib/charts/x-labels';
import type { DateRange, RangePreset } from '@/lib/dashboard/date-range';

export function ChartPanel({ range }: { range: DateRange; onPresetChange?: (preset: RangePreset) => void }) {
  const query = useQuery({
    queryKey: ['dashboard-chart', range.from, range.to],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/chart?from=${range.from}&to=${range.to}`);
      if (!response.ok) throw new Error('Unable to load chart data');
      return (await response.json()) as { series: { date: string; occupancyRate: number; revenue: number; roomsOccupied: number }[] };
    },
  });

  const { xLabelStep, xLabelCount } = chartXLabelControls(range);

  return (
    <ReportCard title="Occupancy & Revenue" subtitle={`${range.from} to ${range.to}`} bodyPadding={false}>
      {query.isLoading ? (
        <div className="px-6 py-6">
          <ChartSkeleton />
        </div>
      ) : null}
      {query.isError ? (
        <div className="px-6 py-6">
          <ErrorMessage line1="Chart data unavailable" line2="Gojo is retrying" line3="Try refreshing the page" />
        </div>
      ) : null}
      {query.data ? (
        <OccupancyRevenueChart
          data={query.data.series}
          {...(xLabelStep ? { xLabelStep } : {})}
          {...(xLabelCount ? { xLabelCount } : {})}
        />
      ) : null}
    </ReportCard>
  );
}
