// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getAlerts } from '@/lib/dashboard/data';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') === 'all' ? 'all' : 'active';
  return NextResponse.json(await getAlerts(actor.propertyId, status));
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
