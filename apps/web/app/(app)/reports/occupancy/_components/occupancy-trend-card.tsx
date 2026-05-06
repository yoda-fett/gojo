'use client';

import { OccupancyRevenueChart } from '@/components/charts/occupancy-revenue-chart';
import { chartXLabelControls } from '@/lib/charts/x-labels';
import type { DateRange } from '@/lib/dashboard/date-range';

type Point = { date: string; occupancyRate: number };

export function OccupancyTrendCard({ data, range }: { data: Point[]; range: DateRange }) {
  const { xLabelStep, xLabelCount } = chartXLabelControls(range);
  return (
    <OccupancyRevenueChart
      data={data.map((point) => ({ date: point.date, occupancyRate: point.occupancyRate, revenue: 0 }))}
      occupancyOnly
      {...(xLabelStep ? { xLabelStep } : {})}
      {...(xLabelCount ? { xLabelCount } : {})}
    />
  );
}
