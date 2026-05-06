// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { listChannels } from '@/lib/services/channels';

export const GET = withAuth(async (_req, actor) => {
  const channels = await listChannels(actor.propertyId);
  return NextResponse.json({ channels });
}, ['OWNER', 'MANAGER']);
