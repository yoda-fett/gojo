import { prisma, todayInIST } from '@gojo/db';

import type { Actor } from '@gojo/types';

import type { RoomCardData } from '@/components/room-card-mobile';

export async function loadMyDay(actor: Actor) {
  const assignedDate = todayInIST();
  const assignments = await prisma.roomAssignment.findMany({
    where: { propertyId: actor.propertyId, staffUserId: actor.userId, assignedDate, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const roomIds = assignments.map((a) => String(a.roomId));
  const [rooms, roomTypes, user, property] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, id: { in: roomIds }, deletedAt: null },
      orderBy: { number: 'asc' },
    }),
    prisma.roomType.findMany({ where: { propertyId: actor.propertyId, deletedAt: null }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
    prisma.property.findUnique({ where: { id: actor.propertyId }, select: { name: true } }),
  ]);
  const assignmentMap = new Map(assignments.map((a) => [a.roomId, a]));
  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  const items: RoomCardData[] = rooms.map((room) => ({
    roomId: String(room.id),
    roomNumber: String(room.number),
    roomType: roomTypeMap.get(String(room.roomTypeId)) ?? 'Room',
    housekeepingState: String(room.state),
    taskTypes: (() => {
      const tasks = assignmentMap.get(String(room.id))?.taskTypes;
      return Array.isArray(tasks) ? tasks.map(String) : [];
    })(),
  }));

  const done = items.filter((r) => r.housekeepingState === 'AVAILABLE').length;
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
