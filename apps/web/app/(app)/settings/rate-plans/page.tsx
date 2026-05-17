// @ts-nocheck
// Story 12.7f. Rate Management hub — Floor Rate Configuration, Rate Plans,
// Rate Multipliers (per wireframe 29). Replaces the legacy in-code Rate
// Management screen (deleted in 12.7f pre-slice cleanup).
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';
import { getBreakEvenForRoomType } from '@/lib/services/break-even-service';

import { RateManagementClient } from './_components/rate-management-client';

export default async function RatePlansPage() {
  const actor = await getServerActor();
  if (!actor) return null;

  const [roomTypes, ratePlans, multipliers] = await Promise.all([
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.ratePlan.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.rateMultiplier.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Per-room-type break-even reference (Story 5.4) — non-blocking advisory.
  const breakEvens = await Promise.all(
    roomTypes.map(async (rt) => {
      try {
        const data = await getBreakEvenForRoomType(actor, rt.id);
        return { roomTypeId: rt.id, breakEvenRate: data?.breakEvenRate ?? null };
      } catch {
        return { roomTypeId: rt.id, breakEvenRate: null };
      }
    }),
  );
  const beById = new Map(breakEvens.map((b) => [b.roomTypeId, b.breakEvenRate]));

  const floorRows = roomTypes.map((rt) => ({
    id: rt.id,
    name: rt.name,
    description: rt.description ?? '',
    baseRate: Number(rt.baseRate),
    floorRate: Number(rt.floorRate),
    stateVersion: rt.stateVersion,
    breakEvenRate: beById.get(rt.id) ?? null,
  }));

  const ratePlanRows = ratePlans.map((rp) => ({
    id: rp.id,
    name: rp.name,
    roomTypeId: rp.roomTypeId,
    modifierType: rp.modifierType,
    modifierValue: Number(rp.modifierValue),
  }));

  const multiplierRows = multipliers.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    multiplier: Number(m.multiplier),
    startDate: m.startDate ? m.startDate.toISOString() : null,
    endDate: m.endDate ? m.endDate.toISOString() : null,
    channel: m.channel,
    roomTypeIds: m.roomTypeIds,
  }));

  return (
    <RateManagementClient
      roomTypes={roomTypes.map((rt) => ({ id: rt.id, name: rt.name }))}
      floorRows={floorRows}
      ratePlans={ratePlanRows}
      multipliers={multiplierRows}
    />
  );
}
