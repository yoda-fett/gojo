// @ts-nocheck
import { prisma } from '@gojo/db';
import { RESERVATION_SOURCE_COLORS, RESERVATION_SOURCE_LABELS } from '@gojo/types';

import { BookingSourceDonut } from '@/components/reports/booking-source-donut';
import { BookingVolumeChart } from '@/components/reports/booking-volume-chart';
import { InsightsPanel } from '@/components/reports/insights-panel';
import { ReportCard } from '@/components/reports/report-card';
import { ReportKpiCard } from '@/components/reports/report-kpi-card';
import { ReportTopbarControls } from '@/components/reports/report-topbar-controls';
import { Topbar } from '@/components/layout/topbar';

import { getServerActor } from '@/lib/auth/server-actor';
import { getReservationsReport } from '@/lib/dashboard/data';
import { parseDateRange } from '@/lib/dashboard/date-range';
import { formatInr, formatPercentValue } from '@/lib/format';

const SOURCE_LABEL = RESERVATION_SOURCE_LABELS as Record<string, string>;
const SOURCE_COLOR = RESERVATION_SOURCE_COLORS as Record<string, string>;

function reservationsInsights(data) {
  const ota = data.bySource.find((row) => row.source === 'OTA');
  const direct = data.bySource.find((row) => row.source === 'DIRECT_BOOKING');
  return [
    ota && ota.cancelRate > (direct?.cancelRate ?? 0) * 1.5 && ota.cancelRate > 5
      ? {
          sentiment: 'caution',
          title: `OTA cancel rate at ${formatPercentValue(ota.cancelRate, 0)}`,
          description: 'Consider tightening cancellation policy on short-notice OTA bookings or adding non-refundable rates.',
        }
      : null,
    data.kpis.avgLeadTime < 5 && data.kpis.totalBookings > 0
      ? {
          sentiment: 'warning',
          title: `Avg lead time only ${data.kpis.avgLeadTime.toFixed(1)} days`,
          description: 'Short lead times limit revenue optimisation. An early-bird direct rate may shift the curve.',
        }
      : null,
    data.kpis.cancellations > 0 && data.kpis.totalBookings > 0
      ? {
          sentiment: 'positive',
          title: `${data.kpis.totalBookings - data.kpis.cancellations} of ${data.kpis.totalBookings} bookings retained`,
          description: `${formatPercentValue((1 - data.kpis.cancellations / data.kpis.totalBookings) * 100, 0)} retention across all sources this period.`,
        }
      : null,
  ].filter(Boolean);
}

export default async function ReservationsReportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
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
    getReservationsReport(actor.propertyId, range),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true } }),
    prisma.room.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
  ]);

  const periodLabel = `${range.from} to ${range.to}`;
  const cancelRate = data.kpis.totalBookings ? (data.kpis.cancellations / data.kpis.totalBookings) * 100 : 0;

  const donutData = data.bySource
    .filter((row) => row.bookings > 0)
    .map((row) => ({
      source: SOURCE_LABEL[row.source] ?? row.source,
      bookings: row.bookings,
      sharePct: row.sharePct,
    }));

  return (
    <div>
      <Topbar
        title="Reservations Report"
        subtitle={`${property?.name ?? 'Property'} · ${roomCount} ${roomCount === 1 ? 'room' : 'rooms'}`}
        controls={
          <ReportTopbarControls
            startDate={range.from}
            endDate={range.to}
            exportHref={`/api/reports/reservations?startDate=${range.from}&endDate=${range.to}`}
            basePath="/reports/reservations"
          />
        }
      />
      <div className="space-y-4 px-4 py-[28px] sm:px-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ReportKpiCard
            label="Total Bookings"
            value={String(data.kpis.totalBookings)}
            subLabel="All reservations created in period"
            delta={data.kpis.vsprior.totalBookings}
          />
          <ReportKpiCard
            label="New Bookings"
            value={String(data.kpis.newBookings)}
            subLabel="Confirmed in this period"
            delta={data.kpis.vsprior.newBookings}
            deltaLabel="vs prior count"
          />
          <ReportKpiCard
            label="Cancellations"
            value={String(data.kpis.cancellations)}
            subLabel={`${formatPercentValue(cancelRate, 1)} cancellation rate`}
            delta={data.kpis.vsprior.cancellations}
            deltaLabel="vs prior count"
          />
          <ReportKpiCard
            label="Average Length of Stay"
            value={`${data.kpis.avgLengthOfStay.toFixed(1)}`}
            subLabel="Nights per booking"
            delta={data.kpis.vsprior.avgLengthOfStay}
            deltaLabel="nights vs prior"
          />
          <ReportKpiCard
            label="Average Lead Time"
            value={`${data.kpis.avgLeadTime.toFixed(1)}`}
            subLabel="Days before check-in"
            delta={data.kpis.vsprior.avgLeadTime}
            deltaLabel="days vs prior"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="space-y-5">
            <ReportCard title="Booking Volume" subtitle={`New bookings per day · ${periodLabel}`} bodyPadding={false}>
              <BookingVolumeChart data={data.bookingVolume} />
            </ReportCard>

            <ReportCard title="Bookings by Source" subtitle={`${periodLabel} · ${data.kpis.totalBookings} total`} bodyPadding={false}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[13px]">
                  <thead>
                    <tr style={{ background: '#FAFCFC' }}>
                      {[
                        { label: 'Source', align: 'left' as const },
                        { label: 'Bookings', align: 'right' as const },
                        { label: 'Avg LOS', align: 'right' as const },
                        { label: 'Avg Lead', align: 'right' as const },
                        { label: 'Cancel Rate', align: 'right' as const },
                        { label: 'Revenue', align: 'right' as const },
                      ].map((column) => (
                        <th
                          key={column.label}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#9EAEAC',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            padding: '10px 24px',
                            borderBottom: '1px solid #F0F5F4',
                            textAlign: column.align,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.bySource.filter((row) => row.bookings > 0).map((row) => {
                      const cancelTone =
                        row.cancelRate >= 10
                          ? 'bg-[rgba(232,118,63,0.1)] text-[#C45A20]'
                          : row.cancelRate > 0
                            ? 'bg-[rgba(233,196,106,0.18)] text-[#9a6a12]'
                            : 'bg-[rgba(29,168,136,0.1)] text-[#0A6B58]';
                      return (
                        <tr key={row.source} className="border-t border-[#F0F5F4]">
                          <td className="px-6 py-3.5">
                            <span className="inline-flex items-center gap-2">
                              <span className="size-2 rounded-full" style={{ backgroundColor: SOURCE_COLOR[row.source] ?? '#9EAEAC' }} />
                              <span className="font-medium text-[var(--color-charcoal)]">{SOURCE_LABEL[row.source] ?? row.source}</span>
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right font-semibold text-[var(--color-charcoal)]">{row.bookings}</td>
                          <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{row.avgLengthOfStay.toFixed(1)} nights</td>
                          <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{row.avgLeadTime.toFixed(1)} days</td>
                          <td className="px-6 py-3.5 text-right">
                            <span className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${cancelTone}`}>
                              {formatPercentValue(row.cancelRate, 1)}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right font-semibold text-[var(--color-charcoal)]">{formatInr(row.revenue)}</td>
                        </tr>
                      );
                    })}
                    {data.bySource.every((row) => row.bookings === 0) ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">
                          No bookings in this period.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t-2 border-[#E8EFEE] px-6 py-3.5">
                <span className="text-[13px] font-semibold text-[var(--color-mid-gray)]">Total</span>
                <span className="text-[15px] font-bold text-[var(--color-charcoal)]">
                  {data.kpis.totalBookings} bookings · {formatInr(data.totalRevenue)} room revenue
                </span>
              </div>
            </ReportCard>
          </div>

          <div className="space-y-5">
            <ReportCard title="Source Mix" subtitle={periodLabel}>
              {donutData.length > 0 ? (
                <BookingSourceDonut
                  data={donutData}
                  valueKey="bookings"
                  totalLabel="Bookings"
                  centerValue={String(data.kpis.totalBookings)}
                />
              ) : (
                <p className="py-10 text-center text-[13px] text-[var(--color-mid-gray)]">No bookings in this period.</p>
              )}
            </ReportCard>

            <ReportCard title="Insights" subtitle="Auto-generated from booking patterns">
              <InsightsPanel insights={reservationsInsights(data)} />
            </ReportCard>
          </div>
        </div>
      </div>
    </div>
  );
}
