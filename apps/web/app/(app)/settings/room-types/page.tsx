// @ts-nocheck
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

import { RoomTypesClient } from './_components/room-types-client';

// Settings → Room Types (Story 12.7c). RSC loads current room types and
// passes them to the client; CRUD goes through the existing /api/room-types
// endpoints (Story 2.4). RBAC guard lives in the settings group layout.
export default async function RoomTypesPage() {
  const actor = await getServerActor();
  if (!actor) {
    return null;
  }

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: actor.propertyId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      maxOccupancy: true,
      baseRate: true,
      floorRate: true,
      gstSlab: true,
      amenities: true,
      stateVersion: true,
    },
  });

  // Serialize Decimal columns to plain strings for the client boundary.
  const initial = roomTypes.map((rt) => ({
    ...rt,
    baseRate: rt.baseRate.toString(),
    floorRate: rt.floorRate.toString(),
  }));

  return <RoomTypesClient initial={initial} />;
}
