// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getRoomsNeedingAttention } from '@/lib/dashboard/data';

export const GET = withAuth(async (_req, actor) => {
  return NextResponse.json(await getRoomsNeedingAttention(actor.propertyId));
}, ['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING']);
