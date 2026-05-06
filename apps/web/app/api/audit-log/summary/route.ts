// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';
import { AUDIT_CATEGORY_MAP, getAuditCategory } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';
import { listDateKeys, parseDateRange } from '@/lib/dashboard/date-range';
import { formatISTDateKey } from '@/lib/tz';

export const GET = withAuth(async (req, actor) => {
  const url = new URL(req.url);
  const range = parseDateRange(url.searchParams.get('startDate'), url.searchParams.get('endDate'), 'mtd');
  const category = url.searchParams.get('category');
  const actorId = url.searchParams.get('actorId');

  const actionFilter = category && AUDIT_CATEGORY_MAP[category] ? AUDIT_CATEGORY_MAP[category] : undefined;
  const from = new Date(`${range.from}T00:00:00+05:30`);
  const to = new Date(`${range.to}T23:59:59.999+05:30`);

  const where = {
    propertyId: actor.propertyId,
    createdAt: { gte: from, lte: to },
    ...(actionFilter && { action: { in: actionFilter } }),
    ...(actorId && { actorId }),
  };

  const [rows, totalEvents, failedLogins, refundsPosted, dataExports] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: { action: true, actorId: true, actorRole: true, createdAt: true },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { ...where, action: 'AUTH_LOGIN_FAILED' } }),
    prisma.auditLog.count({ where: { ...where, action: 'FOLIO_LINE_REFUNDED' } }),
    prisma.auditLog.count({ where: { ...where, action: { in: ['AUDIT_LOG_EXPORTED', 'GUEST_ID_REVEALED'] } } }),
  ]);

  const distinctActors = new Map<string, { actorId: string; actorRole: string }>();
  for (const row of rows) {
    if (!distinctActors.has(row.actorId)) {
      distinctActors.set(row.actorId, { actorId: row.actorId, actorRole: row.actorRole });
    }
  }

  const dateKeys = listDateKeys(range);
  const dailyVolume = dateKeys.map((date) => {
    const day = { date, total: 0, BOOKINGS: 0, BILLING: 0, SETTINGS: 0, OTHER: 0 };
    for (const row of rows) {
      if (formatISTDateKey(row.createdAt) !== date) continue;
      day.total += 1;
      day[getAuditCategory(row.action)] += 1;
    }
    return day;
  });

  return NextResponse.json({
    period: range,
    appliedFilters: { category, actorId },
    kpis: {
      totalEvents,
      activeUsers: distinctActors.size,
      failedLogins,
      refundsPosted,
      dataExports,
    },
    dailyVolume,
    actors: [...distinctActors.values()],
  });
}, ['OWNER']);
