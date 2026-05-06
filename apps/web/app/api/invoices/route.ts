// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';

import { withAuth } from '@/lib/auth/api-handler';
import { parseDateRange } from '@/lib/dashboard/date-range';

export const GET = withAuth(async (req, actor) => {
  const url = new URL(req.url);
  const range = parseDateRange(url.searchParams.get('startDate'), url.searchParams.get('endDate'), 'mtd');
  const from = new Date(`${range.from}T00:00:00+05:30`);
  const to = new Date(`${range.to}T23:59:59.999+05:30`);
  const invoices = await prisma.invoice.findMany({
    where: { propertyId: actor.propertyId, invoiceDate: { gte: from, lte: to } },
    orderBy: { invoiceDate: 'desc' },
  });
  return NextResponse.json({ period: range, invoices });
}, ['OWNER', 'MANAGER']);
