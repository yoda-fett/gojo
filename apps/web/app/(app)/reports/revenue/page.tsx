// @ts-nocheck
import { formatInr, formatPercentValue } from '@/lib/format';
import { ReportCard } from '@/components/reports/report-card';
import { ReportKpiCard } from '@/components/reports/report-kpi-card';
import { BookingSourceDonut } from '@/components/reports/booking-source-donut';
import { DailyRevenueChart } from '@/components/reports/daily-revenue-chart';
import { InsightsPanel } from '@/components/reports/insights-panel';
import { ReportTopbarControls } from '@/components/reports/report-topbar-controls';
import { Topbar } from '@/components/layout/topbar';
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';
import { getRevenueReport } from '@/lib/dashboard/data';
import { parseDateRange } from '@/lib/dashboard/date-range';

function priorFromDelta(current: number, deltaPct: number) {
  const ratio = 1 + deltaPct / 100;
  if (!Number.isFinite(ratio) || ratio === 0) {
    return 0;
  }
  return current / ratio;
}

function formatMetric(label: string, value: number) {
  if (label === 'Occupancy %') {
    return formatPercentValue(value);
  }
  return formatInr(value);
}

function revenueInsights(data) {
  const fastest = [...data.byCategory]
    .filter((row) => row.vsPriorPct !== null && Number.isFinite(row.vsPriorPct))
    .sort((a, b) => b.vsPriorPct - a.vsPriorPct)[0];
  const ota = data.bySource.find((row) => row.source === 'OTA');
  return [
    fastest
      ? {
          sentiment: 'positive',
          title: `${fastest.category} is accelerating`,
          description: `${formatPercentValue(fastest.vsPriorPct, 0)} vs prior period with ${formatPercentValue(fastest.sharePct, 0)} share of revenue.`,
        }
      : null,
    Math.abs(data.kpis.vsprior.adr) > 5
      ? {
          sentiment: data.kpis.vsprior.adr > 0 ? 'positive' : 'caution',
          title: `ADR ${data.kpis.vsprior.adr > 0 ? 'improved' : 'softened'} ${formatPercentValue(Math.abs(data.kpis.vsprior.adr), 0)}`,
          description: data.kpis.vsprior.adr > 0 ? 'Your average daily rate is trending up — a good sign for pricing confidence.' : 'Review discounting pressure and channel mix before rates drift further.',
        }
      : null,
    ota && ota.sharePct > 50
      ? {
          sentiment: 'warning',
          title: `${formatPercentValue(ota.sharePct, 0)} of room revenue is OTA-led`,
          description: 'High OTA dependency can drag margins. Consider nudging more direct demand this month.',
        }
      : null,
  ].filter(Boolean);
}

export default async function RevenueReportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
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
  const exportHref = `/api/reports/revenue/export?startDate=${range.from}&endDate=${range.to}`;
  const [data, property, roomCount] = await Promise.all([
    getRevenueReport(actor.propertyId, range),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true } }),
    prisma.room.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
  ]);
  const periodLabel = `${range.from} to ${range.to}`;

  return (
    <div>
      <Topbar
        title="Revenue Report"
        subtitle={`${property?.name ?? 'Property'} · ${roomCount} ${roomCount === 1 ? 'room' : 'rooms'}`}
        controls={<ReportTopbarControls startDate={range.from} endDate={range.to} exportHref={exportHref} basePath="/reports/revenue" />}
      />
      <div className="space-y-4 px-4 py-[28px] sm:px-8">
        <section className="grid gap-4 xl:grid-cols-5">
          <ReportKpiCard label="Total Revenue" value={formatInr(data.kpis.totalRevenue)} subLabel="All tax-exclusive revenue" delta={data.kpis.vsprior.totalRevenue} />
          <ReportKpiCard label="Room Revenue" value={formatInr(data.kpis.roomRevenue)} subLabel="Room charges only" delta={data.kpis.vsprior.roomRevenue} />
          <ReportKpiCard label="F&B Revenue" value={formatInr(data.kpis.fbRevenue)} subLabel="Food and beverage" delta={data.kpis.vsprior.fbRevenue} />
          <ReportKpiCard label="ADR" value={formatInr(data.kpis.adr)} subLabel="Average daily rate" delta={data.kpis.vsprior.adr} />
          <ReportKpiCard label="RevPAR" value={formatInr(data.kpis.revpar)} subLabel="Revenue per available room" delta={data.kpis.vsprior.revpar} />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="space-y-5">
          <ReportCard title="Daily Revenue Trend" subtitle={`${periodLabel} · posted charges`} bodyPadding={false}>
            <DailyRevenueChart data={data.dailySeries} />
          </ReportCard>
          <ReportCard title="Revenue by Category" subtitle={periodLabel} bodyPadding={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13.5px]">
                <thead>
                  <tr style={{ background: '#FAFCFC' }}>
                    {[
                      { label: 'Category', align: 'left' as const },
                      { label: 'Transactions', align: 'left' as const },
                      { label: 'Share', align: 'right' as const },
                      { label: 'vs Prior', align: 'left' as const },
                      { label: 'Amount', align: 'right' as const },
                    ].map((h) => (
                      <th
                        key={h.label}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#9EAEAC',
                          textTransform: 'uppercase',
                          letterSpacing: '0.6px',
                          padding: '10px 24px',
                          borderBottom: '1px solid #F0F5F4',
                          textAlign: h.align,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.map((row) => {
                    const dot = row.category === 'ROOM' ? '#1DA888' : row.category === 'FB' ? '#E8763F' : '#E9C46A';
                    const label = row.category === 'ROOM' ? 'Room Revenue' : row.category === 'FB' ? 'Restaurant / F&B' : 'Misc / Other';
                    const txnUnit = row.category === 'ROOM' ? 'nights' : row.category === 'FB' ? 'bills' : 'entries';
                    const vsPrior = row.vsPriorPct;
                    const vsTone =
                      vsPrior === null
                        ? 'bg-[rgba(158,174,172,0.12)] text-[#9EAEAC]'
                        : vsPrior > 0
                          ? 'bg-[rgba(29,168,136,0.1)] text-[#0A6B58]'
                          : vsPrior < 0
                            ? 'bg-[rgba(232,118,63,0.1)] text-[#C45A20]'
                            : 'bg-[rgba(158,174,172,0.12)] text-[#9EAEAC]';
                    const vsArrow = vsPrior === null ? '' : vsPrior > 0 ? '↑ ' : vsPrior < 0 ? '↓ ' : '— ';
                    const vsLabel = vsPrior === null ? 'NA' : `${vsArrow}${formatPercentValue(Math.abs(vsPrior), 0)}`;
                    return (
                      <tr key={row.category} className="border-t border-[#F0F5F4] text-[var(--color-charcoal)]">
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="size-2 rounded-full" style={{ backgroundColor: dot }} />
                            <span className="font-medium">{label}</span>
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-[var(--color-mid-gray)]">{row.transactions} {txnUnit}</td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-[5px] w-20 overflow-hidden rounded-[3px] bg-[#F0F5F4]">
                              <div className="h-full rounded-[3px]" style={{ width: `${row.sharePct}%`, backgroundColor: dot }} />
                            </div>
                            <span className="w-9 text-right text-[12px] text-[var(--color-mid-gray)]">{formatPercentValue(row.sharePct, 0)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${vsTone}`}>{vsLabel}</span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold">{formatInr(row.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ReportCard>
          <ReportCard title="Room Revenue by Type" subtitle={periodLabel} bodyPadding={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead><tr style={{ background: '#FAFCFC' }}>{['Room Type', 'Rooms', 'Nights Sold', 'ADR', 'Occupancy', 'Revenue'].map((h, i) => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 600, color: '#9EAEAC', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '10px 24px', borderBottom: '1px solid #F0F5F4', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {data.byRoomType.map((row) => (
                    <tr key={row.roomType} className="border-t border-[#F0F5F4] text-[13.5px] text-[var(--color-charcoal)]">
                      <td className="px-6 py-3.5 font-medium">{row.roomType}</td>
                      <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{row.roomCount}</td>
                      <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{row.nightsSold}</td>
                      <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{formatInr(row.adr)}</td>
                      <td className="px-6 py-3.5 text-right">{formatPercentValue(row.occupancyPct)}</td>
                      <td className="px-6 py-3.5 text-right font-semibold">{formatInr(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportCard>
          </div>

          <div className="space-y-5">
          <ReportCard title="vs Prior Period" subtitle={`${data.priorPeriod.from} to ${data.priorPeriod.to}`} bodyPadding={false}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FCFB' }}>
                  <th style={{ fontSize: 11, fontWeight: 600, color: '#9EAEAC', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 16px', borderBottom: '1px solid #F0F5F4', textAlign: 'left' }}>Metric</th>
                  <th style={{ fontSize: 11, fontWeight: 600, color: '#9EAEAC', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 16px', borderBottom: '1px solid #F0F5F4', textAlign: 'center' }}>This</th>
                  <th style={{ fontSize: 11, fontWeight: 600, color: '#9EAEAC', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 16px', borderBottom: '1px solid #F0F5F4', textAlign: 'center' }}>Prior</th>
                  <th style={{ fontSize: 11, fontWeight: 600, color: '#9EAEAC', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 16px', borderBottom: '1px solid #F0F5F4', textAlign: 'center' }}>Δ</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Total Revenue', data.kpis.totalRevenue, data.kpis.vsprior.totalRevenue],
                  ['Room Revenue', data.kpis.roomRevenue, data.kpis.vsprior.roomRevenue],
                  ['F&B Revenue', data.kpis.fbRevenue, data.kpis.vsprior.fbRevenue],
                  ['ADR', data.kpis.adr, data.kpis.vsprior.adr],
                  ['RevPAR', data.kpis.revpar, data.kpis.vsprior.revpar],
                  ['Occupancy %', data.kpis.occupancyPct, data.kpis.vsprior.occupancyPct],
                  ['Misc / Other', data.kpis.miscRevenue, data.kpis.vsprior.miscRevenue],
                ].map(([label, value, delta]) => {
                  const prior = priorFromDelta(Number(value), Number(delta));
                  const tone = Number(delta) > 0
                    ? 'bg-[rgba(29,168,136,0.1)] text-[#0A6B58]'
                    : Number(delta) < 0
                      ? 'bg-[rgba(232,118,63,0.1)] text-[#C45A20]'
                      : 'bg-[rgba(158,174,172,0.1)] text-[#9EAEAC]';
                  const arrow = Number(delta) > 0 ? '↑' : Number(delta) < 0 ? '↓' : '—';
                  return (
                    <tr key={String(label)} className="border-t border-[#F0F5F4]">
                      <td style={{ padding: '4px 8px', fontSize: 13, color: '#1A2B2E', textAlign: 'left' }}>{label}</td>
                      <td style={{ padding: '4px 8px', fontSize: 13, color: '#1A2B2E', textAlign: 'right' }}>{formatMetric(String(label), Number(value))}</td>
                      <td style={{ padding: '4px 8px', fontSize: 13, color: '#9EAEAC', textAlign: 'right' }}>{formatMetric(String(label), prior)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                        <span className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>
                          {arrow}{formatPercentValue(Math.abs(Number(delta)))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ReportCard>

          <ReportCard title="Revenue by Source" subtitle="Room revenue only · last 30 days">
            <BookingSourceDonut data={data.bySource} valueKey="amount" totalLabel="Room Revenue" centerValue={formatInr(data.kpis.roomRevenue)} />
          </ReportCard>

          <ReportCard title="Insights" subtitle="Auto-generated from channel and pricing patterns">
            <InsightsPanel insights={revenueInsights(data)} />
          </ReportCard>
          </div>
        </div>
      </div>
    </div>
  );
}
