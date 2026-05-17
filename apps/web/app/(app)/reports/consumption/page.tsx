import { Topbar } from '@/components/layout/topbar';
import { ReportCard } from '@/components/reports/report-card';
import { ReportKpiCard } from '@/components/reports/report-kpi-card';
import { ReportTopbarControls } from '@/components/reports/report-topbar-controls';
import { getServerActor } from '@/lib/auth/server-actor';
import { parseDateRange } from '@/lib/dashboard/date-range';
import { getConsumptionReport } from '@/lib/services/consumption-report';

export default async function ConsumptionReportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getServerActor();
  if (!actor || !['OWNER', 'MANAGER'].includes(actor.role)) {
    return (
      <main className="p-8">
        <h1 className="text-lg font-semibold text-slate-900">Forbidden</h1>
        <p className="mt-2 text-sm text-slate-500">Consumption reports are available to Owners and Managers only.</p>
      </main>
    );
  }
  const params = (await searchParams) ?? {};
  const range = parseDateRange(
    typeof params.startDate === 'string' ? params.startDate : null,
    typeof params.endDate === 'string' ? params.endDate : null,
    '30d',
  );
  const data = await getConsumptionReport(actor.propertyId, range);
  const exportHref = `/api/reports/consumption?from=${range.from}&to=${range.to}&format=csv`;
  const anomalies = data.summary.filter((row) => Math.abs(row.variance) >= Math.max(3, row.expectedTotal * 0.25));

  return (
    <div>
      <Topbar
        title="Consumption Report"
        subtitle="Amenity-only variance from par restoration"
        controls={<ReportTopbarControls startDate={range.from} endDate={range.to} exportHref={exportHref} basePath="/reports/consumption" />}
      />
      <div className="space-y-5 px-4 py-7 sm:px-8">
        <section className="grid gap-4 md:grid-cols-3">
          <ReportKpiCard label="Total Used" value={String(data.totals.totalUsed)} subLabel="Amenity units" delta={0} />
          <ReportKpiCard label="Expected" value={String(data.totals.expectedTotal)} subLabel="Checked-out stay par" delta={0} />
          <ReportKpiCard label="Variance" value={String(data.totals.variance)} subLabel="Used minus expected" delta={0} />
        </section>

        <ReportCard title="Amenity Variance" subtitle={data.expectedBasis} bodyPadding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3">Unit</th>
                  <th className="px-6 py-3 text-right">Used</th>
                  <th className="px-6 py-3 text-right">Expected</th>
                  <th className="px-6 py-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {[...data.summary].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).map((row) => (
                  <tr key={row.catalogItemId} className="border-t border-slate-100">
                    <td className="px-6 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-6 py-3 text-slate-500">{row.unit}</td>
                    <td className="px-6 py-3 text-right">{row.totalUsed}</td>
                    <td className="px-6 py-3 text-right">{row.expectedTotal}</td>
                    <td className={`px-6 py-3 text-right font-semibold ${row.variance > 0 ? 'text-orange-700' : row.variance < 0 ? 'text-teal-700' : 'text-slate-700'}`}>{row.variance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportCard>

        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <ReportCard title="Per-Room Breakdown" subtitle={`${range.from} to ${range.to}`} bodyPadding={false}>
            <div className="max-h-[520px] overflow-auto">
              {data.byRoom.map((room) => (
                <section key={room.roomId} className="border-b border-slate-100 p-4">
                  <h2 className="text-sm font-semibold text-slate-900">Room {room.roomNumber}</h2>
                  <p className="text-xs text-slate-500">{room.stays} checked-out stays</p>
                  <div className="mt-3 grid gap-2">
                    {room.items.map((item) => (
                      <div key={item.catalogItemId} className="grid grid-cols-[1fr_70px_70px_70px] gap-2 text-sm">
                        <span>{item.name}</span>
                        <span className="text-right text-slate-500">{item.totalUsed}</span>
                        <span className="text-right text-slate-500">{item.expectedTotal}</span>
                        <span className="text-right font-semibold">{item.variance}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </ReportCard>
          <ReportCard title="Anomaly Callouts" subtitle="Large item variances">
            {anomalies.length === 0 ? <p className="text-sm text-slate-500">No large amenity variance in this range.</p> : null}
            <div className="grid gap-3">
              {anomalies.map((row) => (
                <div key={row.catalogItemId} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <span className="font-semibold">{row.name}</span> variance {row.variance} {row.unit}
                </div>
              ))}
            </div>
          </ReportCard>
        </div>
      </div>
    </div>
  );
}
