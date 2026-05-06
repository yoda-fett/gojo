// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma, writeAuditLog } from '@gojo/db';
import { AUDIT_CATEGORY_MAP } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';

const MAX_ROWS = 10_000;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export const GET = withAuth(async (req, actor) => {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const action = url.searchParams.get('action');
  const actorId = url.searchParams.get('actorId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const actionFilter = action
    ? [action]
    : category && AUDIT_CATEGORY_MAP[category]
      ? AUDIT_CATEGORY_MAP[category]
      : undefined;

  const where = {
    propertyId: actor.propertyId,
    ...(actionFilter && { action: { in: actionFilter } }),
    ...(actorId && { actorId }),
    ...(from || to
      ? {
          createdAt: {
            ...(from && { gte: new Date(`${from}T00:00:00+05:30`) }),
            ...(to && { lte: new Date(`${to}T23:59:59.999+05:30`) }),
          },
        }
      : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });

  await writeAuditLog(prisma, actor, {
    action: 'AUDIT_LOG_EXPORTED',
    entityType: 'AUDIT_LOG',
    entityId: 'export',
    metadata: { filters: { category, action, actorId, from, to }, rowCount: rows.length },
  });

  const header = ['Timestamp (IST)', 'Actor', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Summary'];
  const lines = [header.map(csvEscape).join(',')];
  for (const row of rows) {
    const ist = new Date(row.createdAt.getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .replace(/\..*/, '');
    lines.push(
      [ist, row.actorId, row.actorRole, row.action, row.entityType, row.entityId, row.metadata ?? row.after ?? '']
        .map(csvEscape)
        .join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-log-${Date.now()}.csv"`,
    },
  });
}, ['OWNER']);
