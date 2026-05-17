import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { recordInventoryArrival } from '@/lib/services/housekeeping-inventory';

export const POST = withAuth(async (req, actor) => {
  const result = await recordInventoryArrival(actor, await req.json());
  return NextResponse.json(result, { status: 201 });
}, ['OWNER', 'MANAGER']);
