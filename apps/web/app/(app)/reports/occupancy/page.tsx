// @ts-nocheck
import { ReportCard } from '@/components/reports/report-card';
import { ReportKpiCard } from '@/components/reports/report-kpi-card';
import { WeekdayPatternBars } from '@/components/reports/weekday-pattern-bars';
import { CalendarMonthCard } from './_components/calendar-month-card';
import { BookingSourceDonut } from '@/components/reports/booking-source-donut';
import { InsightsPanel } from '@/components/reports/insights-panel';
import { OccupancyTrendCard } from './_components/occupancy-trend-card';
import { ReportTopbarControls } from '@/components/reports/report-topbar-controls';
import { Topbar } from '@/components/layout/topbar';
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';
import { getOccupancyReport } from '@/lib/dashboard/data';
import { parseDateRange } from '@/lib/dashboard/date-range';
import { formatInr, formatPercentValue } from '@/lib/format';

function occupancyInsights(data) {
  const topRoom = [...data.byRoomType].sort((a, b) => b.occupancyPct - a.occupancyPct)[0];
  const slowDay = [...data.byWeekday].sort((a, b) => a.avgOccupancyPct - b.avgOccupancyPct)[0];
  return [
    topRoom
      ? {
          sentiment: 'positive',
          title: `${topRoom.roomType} is leading occupancy`,
          description: `${formatPercentValue(topRoom.occupancyPct, 0)} occupancy makes it your strongest-performing room type this period.`,
        }
      : null,
    slowDay
      ? {
          sentiment: 'warning',
          title: `${slowDay.weekday} needs a demand push`,
          description: `Average occupancy is ${formatPercentValue(slowDay.avgOccupancyPct, 0)} on ${slowDay.weekday}. Consider packaging or price nudges.`,
        }
      : null,
    {
      sentiment: 'caution',
      title: `${data.kpis.totalRoomNights} room nights sold`,
      description: `Keep occupancy above 80% to hold pricing power while still preserving room mix flexibility.`,
    },
  ].filter(Boolean);
}

export default async function OccupancyReportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER'].includes(actor.role)) {
    return null;
  }

  const params = (await searchParams) ?? {};
  const range = parseDateRange(
    typeof params.startDate === 'string' ? params.startDate : null,
    typeof params.endDate === 'string' ? params.endDate : null,
    '30d',
  );
  const [data, property, roomCount] = await Promise.all([
    getOccupancyReport(actor.propertyId, range),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true } }),
    prisma.room.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
  ]);
  const periodLabel = `${range.from} to ${range.to}`;

  return (
    <div>
      <Topbar
        title="Occupancy Report"
        subtitle={`${property?.name ?? 'Property'} · ${roomCount} ${roomCount === 1 ? 'room' : 'rooms'}`}
        controls={<ReportTopbarControls startDate={range.from} endDate={range.to} exportHref={`/api/reports/occupancy/export?startDate=${range.from}&endDate=${range.to}`} basePath="/reports/occupancy" />}
      />
      <div className="space-y-4 px-4 py-[28px] sm:px-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportKpiCard label="Avg Occupancy %" value={formatPercentValue(data.kpis.avgOccupancyPct)} subLabel="Avg occupied rooms across the period" delta={data.kpis.vsprior.avgOccupancyPct} />
          <ReportKpiCard label="ADR" value={formatInr(data.kpis.adr)} subLabel="Average daily rate" delta={data.kpis.vsprior.adr} />
          <ReportKpiCard label="RevPAR" value={formatInr(data.kpis.revpar)} subLabel="Revenue per available room" delta={data.kpis.vsprior.revpar} />
          <ReportKpiCard label="Total Room Nights" value={String(data.kpis.totalRoomNights)} subLabel="Sold room nights this period" delta={data.kpis.vsprior.totalRoomNights} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="space-y-5">
          <ReportCard title="Occupancy Trend" subtitle="Daily occupancy % over selected period" bodyPadding={false}>
            <OccupancyTrendCard data={data.dailySeries} range={range} />
          </ReportCard>
          <ReportCard title="Occupancy by Room Type" subtitle={periodLabel} bodyPadding={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]"><tr><th className="px-6 pb-3 pt-4">Room Type</th><th className="px-6 pb-3 pt-4 text-right">Rooms</th><th className="px-6 pb-3 pt-4 text-right">Nights Sold</th><th className="px-6 pb-3 pt-4 text-right">ADR</th><th className="px-6 pb-3 pt-4 text-right">Occupancy</th></tr></thead>
                <tbody>
                  {data.byRoomType.map((row) => (
                    <tr key={row.roomType} className="border-t border-[#edf3f1] text-[13.5px] text-[var(--color-charcoal)]">
                      <td className="px-6 py-3.5 font-medium">{row.roomType}</td>
                      <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{row.roomCount}</td>
                      <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{row.nightsSold} / {row.availableNights}</td>
                      <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{formatInr(row.adr)}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-[5px] w-20 overflow-hidden rounded-[3px] bg-[#F0F5F4]">
                            <div className="h-full rounded-[3px] bg-[var(--color-teal)]" style={{ width: `${row.occupancyPct}%`, opacity: row.occupancyPct >= 90 ? 1 : row.occupancyPct >= 75 ? 0.85 : 0.6 }} />
                          </div>
                          <span className="w-9 text-right text-[13px] font-semibold text-[var(--color-charcoal)]">{formatPercentValue(row.occupancyPct, 0)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t-2 border-[#E8EFEE] px-6 py-3.5">
              <span className="text-[13px] font-semibold text-[var(--color-mid-gray)]">Overall</span>
              <span className="text-[15px] font-bold text-[var(--color-charcoal)]">{formatPercentValue(data.kpis.avgOccupancyPct, 0)} · {data.kpis.totalRoomNights} / {data.byRoomType.reduce((sum, row) => sum + row.availableNights, 0)} nights</span>
            </div>
          </ReportCard>
          <ReportCard title="Weekday Pattern" subtitle="Avg occupancy by day of week · last 30 days" bodyPadding={false}>
            <WeekdayPatternBars data={data.byWeekday} />
          </ReportCard>
          </div>

          <div className="space-y-5">
          <CalendarMonthCard />
          <ReportCard title="Booking Source Mix" subtitle="By room nights · last 30 days">
            <BookingSourceDonut data={data.bySource} valueKey="roomNights" totalLabel="Room Nights" centerValue={String(data.kpis.totalRoomNights)} variant="occupancy" />
          </ReportCard>
          <ReportCard title="Insights" subtitle="Automatic reading of your occupancy pattern">
            <InsightsPanel insights={occupancyInsights(data)} />
          </ReportCard>
          </div>
        </div>
      </div>
    </div>
  );
}
