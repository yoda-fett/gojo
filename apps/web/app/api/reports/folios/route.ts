// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getFolioReport } from '@/lib/dashboard/data';
import { parseDateRange } from '@/lib/dashboard/date-range';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  const range = parseDateRange(searchParams.get('startDate'), searchParams.get('endDate'), 'mtd');
  return NextResponse.json(await getFolioReport(actor.propertyId, range));
}, ['OWNER', 'MANAGER']);
