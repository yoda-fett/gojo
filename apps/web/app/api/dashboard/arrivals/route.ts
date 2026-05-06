// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getDashboardSnapshot } from '@/lib/dashboard/data';
import { parseDateRange } from '@/lib/dashboard/date-range';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const range = parseDateRange(date, date, 'today');
  const snapshot = await getDashboardSnapshot(actor.propertyId, actor.role, range);
  return NextResponse.json(snapshot.arrivals);
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
