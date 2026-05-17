import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getLaundryStatus } from '@/lib/services/housekeeping-laundry';

export const GET = withAuth(async (_req, actor) => {
  return NextResponse.json(await getLaundryStatus(actor));
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
