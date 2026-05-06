// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getCalendarWindow } from '@/lib/services/crs-service';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  return NextResponse.json(await getCalendarWindow(actor.propertyId, searchParams.get('from'), searchParams.get('to')));
}, ['OWNER', 'MANAGER']);
