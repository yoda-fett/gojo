// @ts-nocheck
import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

import { RoomsClient } from './_components/rooms-client';

// Settings → Rooms (Story 12.7d). RSC loads current rooms + the room-type
// options the form needs; CRUD goes through /api/rooms + /api/rooms/[id].
// RBAC guard lives in the settings group layout.
export default async function RoomsPage() {
  const actor = await getServerActor();
  if (!actor) return null;

  const [rooms, roomTypes] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        number: true,
        roomTypeId: true,
        floor: true,
        notes: true,
        accessible: true,
        connectingRoomId: true,
        stateVersion: true,
      },
    }),
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return <RoomsClient initialRooms={rooms} roomTypes={roomTypes} />;
}
