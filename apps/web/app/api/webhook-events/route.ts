// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

export const GET = withAuth(async (req, actor) => {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channelId') ?? undefined;
  const status = url.searchParams.get('status') ?? 'FAILED_PERMANENT';

  const events = await prisma.webhookEvent.findMany({
    where: {
      propertyId: actor.propertyId,
      processingStatus: status,
      ...(channelId ? { channelId } : {}),
    },
    orderBy: { receivedAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ events });
}, ['OWNER', 'MANAGER']);
