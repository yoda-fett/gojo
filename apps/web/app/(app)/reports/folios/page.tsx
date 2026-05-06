// @ts-nocheck
import { prisma } from '@gojo/db';

import { CategoryBars } from '@/components/reports/category-bars';
import { ChargesTrendChart } from '@/components/reports/charges-trend-chart';
import { InsightsPanel } from '@/components/reports/insights-panel';
import { ReportCard } from '@/components/reports/report-card';
import { ReportKpiCard } from '@/components/reports/report-kpi-card';
import { ReportTopbarControls } from '@/components/reports/report-topbar-controls';
import { Topbar } from '@/components/layout/topbar';

import { getServerActor } from '@/lib/auth/server-actor';
import { getFolioReport } from '@/lib/dashboard/data';
import { parseDateRange } from '@/lib/dashboard/date-range';
import { formatInr, formatPercentValue } from '@/lib/format';

function folioInsights(data) {
  const sundry = data.byCategory.find((row) => row.category === 'EXTRA_CHARGE');
  return [
    data.kpis.outstanding > 0
      ? {
          sentiment: 'caution',
          title: `${formatInr(data.kpis.outstanding)} outstanding across open folios`,
          description: `${data.kpis.openFolioCount} open folios. Follow up on the oldest balances first.`,
        }
      : null,
    data.kpis.collectionRate >= 90
      ? {
          sentiment: 'positive',
          title: `${formatPercentValue(data.kpis.collectionRate, 1)} collection rate`,
          description: 'Strong settlement velocity this period — most charges are being recovered.',
        }
      : null,
    sundry && sundry.grossPosted > 0
      ? {
          sentiment: 'warning',
          title: `${formatInr(sundry.grossPosted)} in extra charges`,
          description: 'Review posting discipline — sustained extras can indicate uncoded service revenue.',
        }
      : null,
  ].filter(Boolean);
}

export default async function FolioReportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER'].includes(actor.role)) {
    return null;
  }

  const params = (await searchParams) ?? {};
  const range = parseDateRange(
    typeof params.startDate === 'string' ? params.startDate : null,
    typeof params.endDate === 'string' ? params.endDate : null,
    'mtd',
  );

  const [data, property, roomCount] = await Promise.all([
    getFolioReport(actor.propertyId, range),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true } }),
    prisma.room.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
  ]);

  const periodLabel = `${range.from} to ${range.to}`;

  return (
    <div>
      <Topbar
        title="Folio Report"
        subtitle={`${property?.name ?? 'Property'} · ${roomCount} ${roomCount === 1 ? 'room' : 'rooms'}`}
        controls={
          <ReportTopbarControls
            startDate={range.from}
            endDate={range.to}
            exportHref={`/api/reports/folios?startDate=${range.from}&endDate=${range.to}`}
            basePath="/reports/folios"
          />
        }
      />
      <div className="space-y-4 px-4 py-[28px] sm:px-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ReportKpiCard
            label="Total Charged"
            value={formatInr(data.kpis.totalCharged)}
            subLabel={`Across ${data.kpis.closedFolioCount + data.kpis.openFolioCount} folios`}
            delta={data.kpis.vsprior.totalCharged}
          />
          <ReportKpiCard
            label="Total Collected"
            value={formatInr(data.kpis.totalCollected)}
            subLabel={`${formatPercentValue(data.kpis.collectionRate, 1)} settlement rate`}
            delta={data.kpis.vsprior.totalCollected}
          />
          <ReportKpiCard
            label="Outstanding"
            value={formatInr(data.kpis.outstanding)}
            subLabel={`${data.outstandingFolios.length} folios unpaid`}
            delta={0}
            deltaLabel="open folio snapshot"
          />
          <ReportKpiCard
            label="Average Folio Value"
            value={formatInr(data.kpis.avgFolioValue)}
            subLabel="Per checked-out guest"
            delta={0}
            deltaLabel="closed folios in period"
          />
          <ReportKpiCard
            label="Refunds & Adjustments"
            value={formatInr(data.kpis.refundsAdjustments)}
            subLabel="Discounts, refunds, tax adjustments"
            delta={data.kpis.vsprior.refundsAdjustments}
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="space-y-5">
            <ReportCard title="Daily Charges & Collections" subtitle={`Posted vs settled · ${periodLabel}`} bodyPadding={false}>
              <ChargesTrendChart data={data.dailyTrend} />
            </ReportCard>

            <ReportCard title="Charges by Category" subtitle="Gross posted by charge type" bodyPadding={false}>
              <CategoryBars data={data.byCategory} />
            </ReportCard>

            <ReportCard title="Category Breakdown" subtitle={periodLabel} bodyPadding={false}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[13px]">
                  <thead>
                    <tr style={{ background: '#FAFCFC' }}>
                      {[
                        { label: 'Category', align: 'left' as const },
                        { label: 'Folios', align: 'right' as const },
                        { label: 'Gross Posted', align: 'right' as const },
                        { label: 'Adjustments', align: 'right' as const },
                        { label: 'Net Revenue', align: 'right' as const },
                        { label: '% of Total', align: 'right' as const },
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
                    {data.byCategory.map((row) => {
                      const adjustmentsText = row.adjustments < 0 ? `−${formatInr(Math.abs(row.adjustments))}` : row.adjustments > 0 ? formatInr(row.adjustments) : '—';
                      const adjustmentColor = row.adjustments < 0 ? '#C45A20' : '#9EAEAC';
                      return (
                        <tr key={row.category} className="border-t border-[#F0F5F4]">
                          <td className="px-6 py-3.5 font-medium text-[var(--color-charcoal)]">{row.label}</td>
                          <td className="px-6 py-3.5 text-right text-[var(--color-mid-gray)]">{row.folios}</td>
                          <td className="px-6 py-3.5 text-right text-[var(--color-charcoal)]">{formatInr(row.grossPosted)}</td>
                          <td className="px-6 py-3.5 text-right" style={{ color: adjustmentColor }}>{adjustmentsText}</td>
                          <td className="px-6 py-3.5 text-right font-semibold text-[var(--color-charcoal)]">{formatInr(row.netRevenue)}</td>
                          <td className="px-6 py-3.5 text-right">
                            <span className="inline-flex rounded-[4px] bg-[rgba(158,174,172,0.12)] px-1.5 py-0.5 text-[11px] font-medium text-[#9EAEAC]">
                              {formatPercentValue(row.pctOfTotal, 1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {data.byCategory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">
                          No folio activity in this period.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t-2 border-[#E8EFEE] px-6 py-3.5">
                <span className="text-[13px] font-semibold text-[var(--color-mid-gray)]">Total</span>
                <span className="text-[15px] font-bold text-[var(--color-charcoal)]">{formatInr(data.netRevenueTotal)} net</span>
              </div>
            </ReportCard>
          </div>

          <div className="space-y-5">
            <ReportCard title="Outstanding Folios" subtitle={`${data.outstandingFolios.length} unpaid · ${data.outstandingFolios.filter((entry) => entry.overdue).length} overdue`} bodyPadding={false}>
              {data.outstandingFolios.length === 0 ? (
                <p className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">No outstanding folios.</p>
              ) : (
                <ul className="divide-y divide-[#F0F5F4]">
                  {data.outstandingFolios.slice(0, 6).map((folio) => (
                    <li key={folio.folioId} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <div className="text-[13px] font-semibold text-[var(--color-charcoal)]">Folio {folio.folioId.slice(-8).toUpperCase()}</div>
                        <div className="mt-0.5 text-[12px] text-[var(--color-mid-gray)]">
                          {folio.overdue ? `${folio.ageDays} days overdue` : `${folio.ageDays} day${folio.ageDays === 1 ? '' : 's'} pending`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-[var(--color-charcoal)]">{formatInr(folio.balance)}</div>
                        {folio.overdue ? (
                          <span className="mt-0.5 inline-block rounded-[4px] bg-[rgba(232,118,63,0.1)] px-1.5 py-0.5 text-[10px] font-medium text-[#C45A20]">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ReportCard>

            <ReportCard title="Folio Insights" subtitle="Auto-generated from folio activity">
              <InsightsPanel insights={folioInsights(data)} />
            </ReportCard>
          </div>
        </div>
      </div>
    </div>
  );
}
