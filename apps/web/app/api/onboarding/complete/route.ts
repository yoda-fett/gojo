// @ts-nocheck
// Story 12.4 AC5 — defensive re-verification before stamping cold-start
// completion. Owner could have deleted data in another tab between Save &
// Continue on step N and Finish setup on the review screen; we re-check
// every step-1..6 prerequisite server-side and refuse to complete with a
// pointer to the offending step. Step 7 (Direct Booking) is optional.
import { completeColdStart, prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { computeStepGates } from '@/app/onboarding/_gates';
import { withAuth } from '@/lib/auth/api-handler';

export const POST = withAuth(async (_req, actor) => {
  // ── Re-fetch the same counts the wizard RSC computes, in one round-trip.
  const [roomTypes, roomsCount, accessRows, ratePlans, catalogItems] = await Promise.all([
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true },
    }),
    prisma.room.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
    prisma.propertyAccess.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, revokedAt: null },
      select: { role: true },
    }),
    prisma.ratePlan.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { roomTypeId: true },
    }),
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { itemType: true },
    }),
  ]);

  const roomTypesMissingRatePlans = roomTypes.filter(
    (rt) => !ratePlans.some((rp) => rp.roomTypeId === rt.id),
  ).length;

  const gates = computeStepGates({
    roomTypes: roomTypes.length,
    rooms: roomsCount,
    housekeepingMembers: accessRows.filter((a) => a.role === 'HOUSEKEEPING').length,
    roomTypesMissingRatePlans,
    amenityItems: catalogItems.filter((c) => c.itemType === 'AMENITY').length,
    linenItems: catalogItems.filter((c) => c.itemType === 'LINEN').length,
  });

  // Step 7 is optional; only enforce 1..6.
  for (let step = 1; step <= 6; step += 1) {
    const gate = gates[step];
    if (gate && !gate.canContinue) {
      throw new AppError(
        'SETUP_INCOMPLETE',
        gate.gateMessage ?? `Step ${step} is incomplete.`,
        422,
        { details: { step } },
      );
    }
  }

  const state = await prisma.$transaction((tx) => completeColdStart(actor, tx));
  return NextResponse.json({ ok: true, ...state });
}, 'OWNER');
