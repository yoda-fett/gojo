// @ts-nocheck
import { prisma } from '@gojo/db';
import { AUDIT_ACTION_LABELS, AUDIT_CATEGORY_MAP, getAuditCategory } from '@gojo/types';

import { AuditVolumeChart } from '@/components/audit/audit-volume-chart';
import { CategoryFilterChips } from '@/components/audit/category-filter-chips';
import { ReportCard } from '@/components/reports/report-card';
import { ReportKpiCard } from '@/components/reports/report-kpi-card';
import { ReportTopbarControls } from '@/components/reports/report-topbar-controls';
import { Topbar } from '@/components/layout/topbar';

import { getServerActor } from '@/lib/auth/server-actor';
import { listDateKeys, parseDateRange } from '@/lib/dashboard/date-range';
import { formatISTDateKey } from '@/lib/tz';

const PAGE_SIZE = 50;

function formatIstTimestamp(date: Date) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().replace('T', ' ').replace(/\..*/, ' IST');
}

export default async function AuditTrailPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getServerActor();
  if (!actor || actor.role !== 'OWNER') {
    return null;
  }

  const params = (await searchParams) ?? {};
  const range = parseDateRange(
    typeof params.startDate === 'string' ? params.startDate : null,
    typeof params.endDate === 'string' ? params.endDate : null,
    'mtd',
  );
  const category = typeof params.category === 'string' ? params.category : null;
  const actorIdFilter = typeof params.actorId === 'string' ? params.actorId : null;
  const page = Math.max(1, Number(typeof params.page === 'string' ? params.page : '1') || 1);

  const from = new Date(`${range.from}T00:00:00+05:30`);
  const to = new Date(`${range.to}T23:59:59.999+05:30`);
  const actionFilter = category && AUDIT_CATEGORY_MAP[category] ? AUDIT_CATEGORY_MAP[category] : undefined;

  const where = {
    propertyId: actor.propertyId,
    createdAt: { gte: from, lte: to },
    ...(actionFilter && { action: { in: actionFilter } }),
    ...(actorIdFilter && { actorId: actorIdFilter }),
  };

  const [property, summaryRows, totalEvents, failedLogins, refundsPosted, dataExports, tableRows, tableTotal] = await Promise.all([
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true } }),
    prisma.auditLog.findMany({ where, select: { action: true, actorId: true, actorRole: true, createdAt: true } }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { ...where, action: 'AUTH_LOGIN_FAILED' } }),
    prisma.auditLog.count({ where: { ...where, action: 'FOLIO_LINE_REFUNDED' } }),
    prisma.auditLog.count({ where: { ...where, action: { in: ['AUDIT_LOG_EXPORTED', 'GUEST_ID_REVEALED'] } } }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const distinctActorIds = new Set(summaryRows.map((row) => row.actorId));
  const userLookup = distinctActorIds.size
    ? Object.fromEntries(
        (await prisma.user.findMany({
          where: { id: { in: [...distinctActorIds] } },
          select: { id: true, name: true, phone: true },
        })).map((user) => [user.id, user]),
      )
    : {};

  const dateKeys = listDateKeys(range);
  const dailyVolume = dateKeys.map((date) => {
    const day = { date, total: 0, BOOKINGS: 0, BILLING: 0, SETTINGS: 0, OTHER: 0 };
    for (const row of summaryRows) {
      if (formatISTDateKey(row.createdAt) !== date) continue;
      day.total += 1;
      day[getAuditCategory(row.action)] += 1;
    }
    return day;
  });

  const totalPages = Math.max(1, Math.ceil(tableTotal / PAGE_SIZE));
  const exportHref = `/api/audit-log/export?from=${range.from}&to=${range.to}${category ? `&category=${category}` : ''}${actorIdFilter ? `&actorId=${actorIdFilter}` : ''}`;

  return (
    <div>
      <Topbar
        title="Audit Trail"
        subtitle={`${property?.name ?? 'Property'} · ${range.from} to ${range.to}`}
        controls={
          <ReportTopbarControls
            startDate={range.from}
            endDate={range.to}
            exportHref={exportHref}
            basePath="/audit"
          />
        }
      />
      <div className="space-y-4 px-4 py-[28px] sm:px-8">
        <CategoryFilterChips basePath="/audit" />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ReportKpiCard label="Total Events" value={String(totalEvents)} subLabel={`Across ${dateKeys.length} days`} delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Active Users" value={String(distinctActorIds.size)} subLabel="Distinct actors" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Failed Logins" value={String(failedLogins)} subLabel="OTP / auth failures" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Refunds Posted" value={String(refundsPosted)} subLabel="Folio line refunds" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Data Exports" value={String(dataExports)} subLabel="Audit + guest ID reveals" delta={0} deltaLabel="this period" />
        </section>

        <ReportCard title="Daily Event Volume" subtitle={`${range.from} to ${range.to}`} bodyPadding={false}>
          <AuditVolumeChart data={dailyVolume} />
        </ReportCard>

        <ReportCard title="Audit Events" subtitle={`${tableTotal} matching events · page ${page} of ${totalPages}`} bodyPadding={false}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr style={{ background: '#FAFCFC' }}>
                  {['Timestamp (IST)', 'Actor', 'Role', 'Action', 'Entity', 'Summary'].map((label, i) => (
                    <th
                      key={label}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#9EAEAC',
                        textTransform: 'uppercase',
                        letterSpacing: '0.6px',
                        padding: '10px 24px',
                        borderBottom: '1px solid #F0F5F4',
                        textAlign: i === 5 ? 'left' : 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  const user = userLookup[row.actorId];
                  const summary = row.metadata
                    ? Object.entries(row.metadata as Record<string, unknown>)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                        .join(' · ')
                    : row.fromState && row.toState
                      ? `${row.fromState} → ${row.toState}`
                      : '—';
                  return (
                    <tr key={row.id} className="border-t border-[#F0F5F4]">
                      <td className="px-6 py-3 font-mono text-[12px] text-[var(--color-mid-gray)]">{formatIstTimestamp(row.createdAt)}</td>
                      <td className="px-6 py-3 text-[var(--color-charcoal)]">{user?.name ?? user?.phone ?? row.actorId.slice(-8)}</td>
                      <td className="px-6 py-3 text-[var(--color-mid-gray)]">{row.actorRole}</td>
                      <td className="px-6 py-3 font-medium text-[var(--color-charcoal)]">{AUDIT_ACTION_LABELS[row.action] ?? row.action}</td>
                      <td className="px-6 py-3 text-[var(--color-mid-gray)]">{row.entityType} · {row.entityId.slice(-6)}</td>
                      <td className="px-6 py-3 text-[var(--color-mid-gray)]">{summary}</td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-[var(--color-mid-gray)]">
                      No audit entries match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-[#F0F5F4] px-6 py-3 text-[12px] text-[var(--color-mid-gray)]">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, tableTotal)} of {tableTotal}</span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <a className="rounded border border-[#E8EFEE] px-3 py-1 text-[var(--color-charcoal)]" href={`/audit?startDate=${range.from}&endDate=${range.to}${category ? `&category=${category}` : ''}&page=${page - 1}`}>
                    ← Previous
                  </a>
                ) : null}
                {page < totalPages ? (
                  <a className="rounded border border-[#E8EFEE] px-3 py-1 text-[var(--color-charcoal)]" href={`/audit?startDate=${range.from}&endDate=${range.to}${category ? `&category=${category}` : ''}&page=${page + 1}`}>
                    Next →
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </ReportCard>
      </div>
    </div>
  );
}
