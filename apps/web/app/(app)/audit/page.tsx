// @ts-nocheck
import { CircleAlert, Star } from 'lucide-react';

import { prisma } from '@gojo/db';
import { AUDIT_ACTION_LABELS, AUDIT_CATEGORY_MAP, getAuditCategory } from '@gojo/types';

import { formatAuditSummary } from '@/lib/audit/format-summary';
import { FLAGGED_ACTIONS, isFlaggedAction } from '@/lib/audit/flagged-actions';
import { ActorFilter, type AuditActorOption } from '@/components/audit/actor-filter';
import { AuditEventsTable, type AuditEventRow } from '@/components/audit/audit-events-table';
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

// Short, human-readable form for table cells: "May 18, 14:32".
function formatTimestampShort(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const dayMonth = ist.toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const hhmm = ist.toISOString().slice(11, 16);
  return `${dayMonth}, ${hhmm}`;
}

function moduleLabel(key: string): string {
  return key.charAt(0) + key.slice(1).toLowerCase();
}

// "Today" / "Yesterday" / "Apr 14" relative to today (IST).
function formatRelativeDay(date: Date): string {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const istThen = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const todayKey = istNow.toISOString().slice(0, 10);
  const thenKey = istThen.toISOString().slice(0, 10);
  if (todayKey === thenKey) return 'Today';
  const y = new Date(istNow.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (y === thenKey) return 'Yesterday';
  return istThen.toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

function roleLabel(role: string): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'MANAGER') return 'Manager';
  if (role === 'FRONT_DESK') return 'Receptionist';
  if (role === 'HOUSEKEEPING') return 'Housekeeping';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Rank palettes for the Activity by User card — top performer in teal,
// then amber, then two greys. Matches the dashboard's chart legend.
const RANK_STYLES: Array<{ avatarBg: string; avatarText: string; bar: string }> = [
  { avatarBg: 'bg-[#D5EAE5]', avatarText: 'text-[#0A6B58]', bar: 'bg-[#3DAE92]' },
  { avatarBg: 'bg-[#FAEFCB]', avatarText: 'text-[#8a6610]', bar: 'bg-[#E9C46A]' },
  { avatarBg: 'bg-[#E6EBEA]', avatarText: 'text-[var(--color-charcoal)]', bar: 'bg-[#9EAEAC]' },
  { avatarBg: 'bg-[#EEF2F1]', avatarText: 'text-[var(--color-mid-gray)]', bar: 'bg-[#C9D2D0]' },
];

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
  const flaggedOnly = params.flagged === '1';
  const page = Math.max(1, Number(typeof params.page === 'string' ? params.page : '1') || 1);

  const from = new Date(`${range.from}T00:00:00+05:30`);
  const to = new Date(`${range.to}T23:59:59.999+05:30`);
  const categoryActions = category && AUDIT_CATEGORY_MAP[category] ? AUDIT_CATEGORY_MAP[category] : undefined;
  // If both Flagged and a Category are on, intersect; the Flagged set is the
  // narrower filter so use it as the source of truth and let category trim it.
  const actionFilter = flaggedOnly
    ? (categoryActions
        ? Array.from(FLAGGED_ACTIONS).filter((a) => categoryActions.includes(a))
        : Array.from(FLAGGED_ACTIONS))
    : categoryActions;

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
    const day = { date, total: 0, flagged: 0, BOOKINGS: 0, BILLING: 0, SETTINGS: 0, OTHER: 0 };
    for (const row of summaryRows) {
      if (formatISTDateKey(row.createdAt) !== date) continue;
      day.total += 1;
      day[getAuditCategory(row.action)] += 1;
      if (isFlaggedAction(row.action)) day.flagged += 1;
    }
    return day;
  });

  // Events by Module summary (across the filtered range, ignoring page).
  // Tracks count + flagged count + top action per module.
  const eventsByModule = (() => {
    type ModuleBucket = { count: number; flagged: number; actionCounts: Map<string, number> };
    const make = (): ModuleBucket => ({ count: 0, flagged: 0, actionCounts: new Map() });
    const buckets: Record<string, ModuleBucket> = {
      BOOKINGS: make(),
      BILLING: make(),
      SETTINGS: make(),
      OTHER: make(),
    };
    for (const row of summaryRows) {
      const mod = getAuditCategory(row.action);
      const b = buckets[mod]!;
      b.count += 1;
      if (isFlaggedAction(row.action)) b.flagged += 1;
      b.actionCounts.set(row.action, (b.actionCounts.get(row.action) ?? 0) + 1);
    }
    return buckets;
  })();
  function topAction(mod: string): string {
    const bucket = eventsByModule[mod];
    if (!bucket || bucket.actionCounts.size === 0) return '—';
    let bestAction = '';
    let bestCount = 0;
    for (const [action, count] of bucket.actionCounts) {
      if (count > bestCount) {
        bestAction = action;
        bestCount = count;
      }
    }
    return AUDIT_ACTION_LABELS[bestAction as keyof typeof AUDIT_ACTION_LABELS] ?? bestAction;
  }

  // Activity by User — actor → event count + most-recent role, sorted desc.
  const activityByUser = (() => {
    const counts = new Map<string, number>();
    const roleByActor = new Map<string, string>();
    for (const row of summaryRows) {
      counts.set(row.actorId, (counts.get(row.actorId) ?? 0) + 1);
      if (!roleByActor.has(row.actorId)) roleByActor.set(row.actorId, row.actorRole);
    }
    const rows = Array.from(counts.entries())
      .map(([actorId, count]) => {
        const u = userLookup[actorId];
        return {
          actorId,
          name: u?.name ?? u?.phone ?? actorId.slice(-8),
          role: roleByActor.get(actorId) ?? '',
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 0);
    return rows.map((r) => ({ ...r, pct: maxCount > 0 ? Math.round((r.count / maxCount) * 100) : 0 }));
  })();

  // Recent flagged events for the right-rail card.
  const flaggedWhere = {
    propertyId: actor.propertyId,
    createdAt: { gte: from, lte: to },
    action: { in: Array.from(FLAGGED_ACTIONS) },
  };
  const [recentFlagged, totalFlagged] = await Promise.all([
    prisma.auditLog.findMany({
      where: flaggedWhere,
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { id: true, action: true, actorId: true, createdAt: true, metadata: true, fromState: true, toState: true },
    }),
    prisma.auditLog.count({ where: flaggedWhere }),
  ]);

  // Audit Insights — heuristic surfacing of patterns worth Owner attention.
  // `kind`: 'alert' → coral square + alert glyph; 'info' → amber square + star.
  const insights: { kind: 'alert' | 'info'; title: string; desc: string }[] = [];
  if (failedLogins > 0) {
    insights.push({
      kind: 'alert',
      title: `${failedLogins} failed login${failedLogins === 1 ? '' : 's'}`,
      desc:
        failedLogins >= 5
          ? 'Consider enabling two-factor authentication. Recurring OTP failures may indicate external probing.'
          : 'A handful of OTP failures — typical for new staff onboarding, but worth a glance.',
    });
  }
  if (refundsPosted > 0) {
    insights.push({
      kind: 'alert',
      title: refundsPosted === 1 ? 'Refund posted without dual approval' : `${refundsPosted} refunds posted`,
      desc:
        refundsPosted === 1
          ? 'A refund was approved without a manager counter-sign. Review your approval workflow settings.'
          : 'Spot-check that each refund has supporting context (reason + manager sign-off).',
    });
  }
  if (dataExports > 3) {
    insights.push({
      kind: 'info',
      title: `Export volume up — ${dataExports} in this period`,
      desc: 'Normal for audit preparation — no action required unless unexpected.',
    });
  }
  if (insights.length === 0) {
    insights.push({
      kind: 'info',
      title: 'No issues flagged',
      desc: 'No sensitive events in the current range that need owner attention.',
    });
  }

  const actorOptions: AuditActorOption[] = Object.values(userLookup)
    .map((u) => ({
      id: u.id,
      label: `${u.name ?? u.phone}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // "Apr 1 – 16" form for Insights card subtitle.
  const insightsRangeLabel = (() => {
    const fromIst = new Date(from.getTime() + 5.5 * 60 * 60 * 1000);
    const toIst = new Date(to.getTime() + 5.5 * 60 * 60 * 1000);
    const fromMon = fromIst.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
    const toMon = toIst.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
    const fromDay = fromIst.getUTCDate();
    const toDay = toIst.getUTCDate();
    return fromMon === toMon ? `${fromMon} ${fromDay}–${toDay}` : `${fromMon} ${fromDay} – ${toMon} ${toDay}`;
  })();

  const totalPages = Math.max(1, Math.ceil(tableTotal / PAGE_SIZE));
  const exportHref = `/api/audit-log/export?from=${range.from}&to=${range.to}${category ? `&category=${category}` : ''}${actorIdFilter ? `&actorId=${actorIdFilter}` : ''}${flaggedOnly ? '&flagged=1' : ''}`;

  // Flatten table rows for the sortable client table.
  const flatTableRows: AuditEventRow[] = tableRows.map((row) => {
    const user = userLookup[row.actorId];
    const moduleKey = getAuditCategory(row.action);
    return {
      id: row.id,
      timestampIso: row.createdAt.toISOString(),
      timestampShort: formatTimestampShort(row.createdAt),
      actorName: user?.name ?? user?.phone ?? row.actorId.slice(-8),
      actorRole: row.actorRole,
      moduleKey,
      moduleLabel: moduleLabel(moduleKey),
      action: row.action,
      actionLabel: AUDIT_ACTION_LABELS[row.action] ?? row.action,
      entityLabel: `${row.entityType} · ${row.entityId.slice(-6)}`,
      summary: formatAuditSummary({
        action: row.action,
        metadata: row.metadata as Record<string, unknown> | null,
        fromState: row.fromState,
        toState: row.toState,
      }),
      flagged: isFlaggedAction(row.action),
    };
  });

  // Recent flagged rows (for the right-rail card) — formatted for display.
  const flaggedDisplay = recentFlagged.map((row) => {
    const user = userLookup[row.actorId];
    return {
      id: row.id,
      label: AUDIT_ACTION_LABELS[row.action] ?? row.action,
      moduleLabel: moduleLabel(getAuditCategory(row.action)),
      actorName: user?.name ?? user?.phone ?? row.actorId.slice(-8),
      timestampShort: formatTimestampShort(row.createdAt),
      relativeDay: formatRelativeDay(row.createdAt),
      summary: formatAuditSummary({
        action: row.action,
        metadata: row.metadata as Record<string, unknown> | null,
        fromState: row.fromState,
        toState: row.toState,
      }),
    };
  });
  const olderFlaggedCount = Math.max(0, totalFlagged - flaggedDisplay.length);

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
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--color-line-soft)] bg-white px-5 py-3 shadow-[0_1px_3px_rgba(26,43,46,0.05)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-mid-gray)]">Filters</span>
          <CategoryFilterChips basePath="/audit" />
          <div className="ml-auto">
            <ActorFilter actors={actorOptions} basePath="/audit" />
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ReportKpiCard label="Total Events" value={String(totalEvents)} subLabel={`Across ${dateKeys.length} days`} delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Active Users" value={String(distinctActorIds.size)} subLabel="Distinct actors" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Failed Logins" value={String(failedLogins)} subLabel="OTP / auth failures" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Refunds Posted" value={String(refundsPosted)} subLabel="Folio line refunds" delta={0} deltaLabel="this period" />
          <ReportKpiCard label="Data Exports" value={String(dataExports)} subLabel="Audit + guest ID reveals" delta={0} deltaLabel="this period" />
        </section>

        <div className="grid gap-4 xl:grid-cols-3 xl:items-stretch">
          <ReportCard className="h-full" title="Activity by User" subtitle="Events attributed per staff member" bodyPadding={false}>
            {activityByUser.length === 0 ? (
              <p className="px-6 py-5 text-[13px] text-[var(--color-mid-gray)]">No activity in the current range.</p>
            ) : (
              <ul className="divide-y divide-[#F0F5F4]">
                {activityByUser.map((user, idx) => {
                  const initials = initialsOf(user.name) || '·';
                  const palette = RANK_STYLES[Math.min(idx, RANK_STYLES.length - 1)]!;
                  return (
                    <li key={user.actorId} className="flex items-center gap-3 px-6 py-3.5">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${palette.avatarBg} ${palette.avatarText}`}>
                        {initials}
                      </div>
                      <div className="min-w-0 w-[35%]">
                        <div className="truncate text-[13.5px] font-semibold text-[var(--color-charcoal)]">{user.name}</div>
                        <div className="truncate text-[12px] text-[var(--color-mid-gray)]">{roleLabel(user.role)}</div>
                      </div>
                      <div className="flex-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF2F1]">
                          <div className={`h-full rounded-full ${palette.bar}`} style={{ width: `${user.pct}%` }} aria-hidden="true" />
                        </div>
                      </div>
                      <span className="w-[44px] text-right text-[14px] font-bold text-[var(--color-charcoal)]">{user.count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </ReportCard>

          <ReportCard
            className="h-full"
            title="Flagged Events"
            subtitle="Requires owner review"
            bodyPadding={false}
            controls={totalFlagged > 0 ? (
              <span className="inline-flex items-center rounded-[6px] bg-[rgba(232,118,63,0.10)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-coral)]">
                {totalFlagged} total
              </span>
            ) : undefined}
          >
            {flaggedDisplay.length === 0 ? (
              <p className="px-6 py-5 text-[13px] text-[var(--color-mid-gray)]">No flagged events in the current range.</p>
            ) : (
              <ol className="divide-y divide-[#F0F5F4]">
                {flaggedDisplay.map((event) => (
                  <li key={event.id} className="flex gap-3 px-6 py-3.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--color-coral)]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold leading-snug text-[var(--color-charcoal)]">{event.label}</div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--color-mid-gray)]">
                        {event.moduleLabel} · {event.timestampShort} · {event.actorName}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11.5px] text-[var(--color-mid-gray)]">{event.relativeDay}</span>
                  </li>
                ))}
                {olderFlaggedCount > 0 ? (
                  <li className="flex items-center gap-3 px-6 py-3.5">
                    <span className="size-2 shrink-0 rounded-full bg-[#C9D2D0]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-[var(--color-charcoal)]">+{olderFlaggedCount} older flagged events</div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--color-mid-gray)]">{insightsRangeLabel}</div>
                    </div>
                    <a className="shrink-0 text-[12.5px] font-semibold text-[var(--color-teal-dark)]" href={`/audit?startDate=${range.from}&endDate=${range.to}&flagged=1`}>
                      View →
                    </a>
                  </li>
                ) : null}
              </ol>
            )}
          </ReportCard>

          <ReportCard className="h-full" title="Audit Insights" subtitle={`Auto-generated · ${insightsRangeLabel}`} bodyPadding={false}>
            <ul className="divide-y divide-[#F0F5F4]">
              {insights.map((insight, i) => {
                const isAlert = insight.kind === 'alert';
                return (
                  <li key={i} className="flex gap-3 px-6 py-3.5">
                    <span
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[8px] ${
                        isAlert
                          ? 'bg-[rgba(232,118,63,0.12)] text-[var(--color-coral)]'
                          : 'bg-[rgba(233,196,106,0.18)] text-[#8a6610]'
                      }`}
                      aria-hidden="true"
                    >
                      {isAlert ? <CircleAlert className="size-4" /> : <Star className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-[var(--color-charcoal)]">{insight.title}</div>
                      <p className="mt-0.5 text-[12px] leading-[1.55] text-[var(--color-mid-gray)]">{insight.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ReportCard>
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
          <ReportCard className="h-full" title="Recent Activity Log" subtitle={`${tableTotal} matching events · page ${page} of ${totalPages}`} bodyPadding={false}>
            <AuditEventsTable rows={flatTableRows} />
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

          <div className="flex flex-col gap-4">
            <ReportCard title="Daily Event Volume" subtitle={`All system events · ${insightsRangeLabel}`} bodyPadding={false}>
              <AuditVolumeChart data={dailyVolume} />
            </ReportCard>

            <ReportCard title="Events by Module" subtitle={`Breakdown of all system actions · ${totalEvents} events total`} bodyPadding={false}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[12px]">
                  <thead>
                    <tr style={{ background: '#FAFCFC' }}>
                      {['Module', 'Events', 'Flagged', 'Top Action', '% of Total'].map((label) => (
                        <th
                          key={label}
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#9EAEAC',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            padding: '10px 12px',
                            borderBottom: '1px solid #F0F5F4',
                            textAlign: label === '% of Total' || label === 'Events' || label === 'Flagged' ? 'right' : 'left',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['BOOKINGS', 'BILLING', 'SETTINGS', 'OTHER'] as const).map((mod) => {
                      const bucket = eventsByModule[mod]!;
                      const pct = totalEvents > 0 ? Math.round((bucket.count / totalEvents) * 100) : 0;
                      return (
                        <tr key={mod} className="border-t border-[#F0F5F4]">
                          <td className="px-4 py-3 font-semibold text-[var(--color-charcoal)]">{moduleLabel(mod)}</td>
                          <td className="px-3 py-3 text-center font-mono text-[var(--color-charcoal)]">{bucket.count}</td>
                          <td className="px-3 py-3 text-center">
                            {bucket.flagged > 0 ? (
                              <span className="inline-flex rounded-[6px] bg-[rgba(232,118,63,0.10)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-coral)]">
                                {bucket.flagged}
                              </span>
                            ) : (
                              <span className="text-[var(--color-mid-gray)]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-[var(--color-mid-gray)]">{topAction(mod)}</td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex rounded-[6px] bg-[var(--color-off-white)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-charcoal)]">
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          </div>
        </div>
      </div>
    </div>
  );
}
