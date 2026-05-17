import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getInventoryLevels } from '@/lib/services/housekeeping-inventory';

export const GET = withAuth(async (_req, actor) => {
  const data = await getInventoryLevels(actor);
  return NextResponse.json(data);
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
