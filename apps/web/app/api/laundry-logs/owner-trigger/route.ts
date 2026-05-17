import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { ownerTriggerLaundry } from '@/lib/services/housekeeping-laundry';

export const POST = withAuth(async (req, actor) => {
  const result = await ownerTriggerLaundry(actor, await req.json());
  return NextResponse.json(result, { status: 201 });
}, ['OWNER', 'MANAGER']);
