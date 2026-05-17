// @ts-nocheck
// Story 12.4 AC4 — explicit audit for Owner choosing to skip step 7 (Direct
// booking config). The skip itself is a no-op on persistence (the wizard
// already supports `optional`); this endpoint just stamps the audit so we
// can answer "how many cold-starts skipped direct booking?" downstream.
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

export const POST = withAuth(async (_req, actor) => {
  await prisma.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'PROPERTY',
      entityId: actor.propertyId,
      action: 'COLD_START_DIRECT_BOOKING_SKIPPED',
      actorId: actor.userId,
      actorRole: actor.role,
    },
  });
  return NextResponse.json({ ok: true });
}, 'OWNER');
