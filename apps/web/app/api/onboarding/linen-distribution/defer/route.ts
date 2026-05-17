// @ts-nocheck
// Story 12.5 AC4 — defer cold-start linen seeding. Sets
// `Property.coldStartLinenDeferred = true`; the wizard then advances to
// step 7 without writing RoomLinenState. Property excluded from First-Shift
// Reconciliation auto-trigger until the owner re-enters the flow and seeds.
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

export const POST = withAuth(async (_req, actor) => {
  await prisma.$transaction(async (tx) => {
    await tx.property.update({
      where: { id: actor.propertyId },
      data: { coldStartLinenDeferred: true },
    });
    await tx.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'PROPERTY',
        entityId: actor.propertyId,
        action: 'COLD_START_LINEN_DEFERRED',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });
  });
  return NextResponse.json({ ok: true });
}, ['OWNER']);
