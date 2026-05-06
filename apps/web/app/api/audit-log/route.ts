// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';
import { AUDIT_CATEGORY_MAP } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';

const PAGE_SIZE = 50;

export const GET = withAuth(async (req, actor) => {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
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

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}, ['OWNER']);
