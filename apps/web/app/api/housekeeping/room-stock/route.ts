import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getRoomStock } from '@/lib/services/housekeeping-room-stock';

export const GET = withAuth(async (_req, actor) => {
  return NextResponse.json(await getRoomStock(actor));
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
