import { deriveRoomStatus, prisma, todayInIST } from '@gojo/db';

import type { Actor } from '@gojo/types';

import type { RoomCardData } from '@/components/room-card-mobile';

// The housekeeping app receives loosely-typed Prisma rows (the generated model
// types degrade to index signatures across the package boundary), so every
// field is coerced explicitly — the same defensive pattern the rest of this
// file already uses.
export async function loadMyDay(actor: Actor) {
  const assignedDate = todayInIST();
  const assignments = await prisma.roomAssignment.findMany({
    where: { propertyId: actor.propertyId, staffUserId: actor.userId, assignedDate, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const roomIds = assignments.map((a) => String(a.roomId));
  const [rooms, roomTypes, user, property, reservations, blocks] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, id: { in: roomIds }, deletedAt: null },
      orderBy: { number: 'asc' },
    }),
    prisma.roomType.findMany({ where: { propertyId: actor.propertyId, deletedAt: null }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true } }),
    // Epic 15: reservations + blocks feed `deriveRoomStatus` so each card can
    // show the composed occupancy-context chip.
    prisma.reservation.findMany({
      where: {
        propertyId: actor.propertyId,
        roomId: { in: roomIds },
        deletedAt: null,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      },
    }),
    prisma.roomBlock.findMany({
      where: {
        propertyId: actor.propertyId,
        roomId: { in: roomIds },
        deletedAt: null,
        OR: [{ endDate: null }, { endDate: { gte: assignedDate } }],
      },
    }),
  ]);
  const assignmentMap = new Map(assignments.map((a) => [String(a.roomId), a]));
  const roomTypeMap = new Map(roomTypes.map((rt) => [String(rt.id), String(rt.name)]));

  const reservationsByRoom = new Map<string, Array<{ status: string; checkIn: Date; checkOut: Date }>>();
  for (const r of reservations) {
    const key = String(r.roomId);
    const arr = reservationsByRoom.get(key) ?? [];
    arr.push({ status: String(r.status), checkIn: r.checkIn as Date, checkOut: r.checkOut as Date });
    reservationsByRoom.set(key, arr);
  }
  const blocksByRoom = new Map<
    string,
    Array<{ blockType: string; startDate: Date; endDate: Date | null; reason: string; deletedAt: Date | null }>
  >();
  for (const b of blocks) {
    const key = String(b.roomId);
    const arr = blocksByRoom.get(key) ?? [];
    arr.push({
      blockType: String(b.blockType),
      startDate: b.startDate as Date,
      endDate: (b.endDate as Date | null) ?? null,
      reason: String(b.reason),
      deletedAt: (b.deletedAt as Date | null) ?? null,
    });
    blocksByRoom.set(key, arr);
  }
  const now = new Date();

  const items: RoomCardData[] = rooms.map((room) => {
    const roomId = String(room.id);
    const status = deriveRoomStatus(
      {
        housekeepingStatus: String(room.housekeepingStatus),
        holdExpiresAt: (room.holdExpiresAt as Date | null) ?? null,
      },
      reservationsByRoom.get(roomId) ?? [],
      blocksByRoom.get(roomId) ?? [],
      now,
    );
    return {
      roomId,
      roomNumber: String(room.number),
      roomType: roomTypeMap.get(String(room.roomTypeId)) ?? 'Room',
      housekeepingState: String(room.housekeepingStatus),
      roomContext: status.display,
      taskTypes: (() => {
        const tasks = assignmentMap.get(roomId)?.taskTypes;
        return Array.isArray(tasks) ? tasks.map(String) : [];
      })(),
    };
  });

  const done = items.filter((r) => r.housekeepingState === 'CLEAN').length;
  const inProgress = items.filter((r) => r.housekeepingState === 'DIRTY').length;

  return {
    items,
    done,
    inProgress,
    total: items.length,
    userName: user?.name ?? 'Staff',
    propertyName: property?.name ?? 'Property',
    dateLabel: new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(assignedDate),
  };
}
