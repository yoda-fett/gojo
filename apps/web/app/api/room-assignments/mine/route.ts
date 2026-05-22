// @ts-nocheck
import { istDateFromKey, prisma, todayInIST } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

function dateFromParam(value: string | null) {
  if (!value) return todayInIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError('VALIDATION_ERROR', 'date must use yyyy-MM-dd', 422);
  return istDateFromKey(value);
}

export const GET = withAuth(async (req, actor) => {
  const assignedDate = dateFromParam(new URL(req.url).searchParams.get('date'));
  const assignments = await prisma.roomAssignment.findMany({
    where: {
      propertyId: actor.propertyId,
      staffUserId: actor.userId,
      assignedDate,
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });
  const roomIds = assignments.map((assignment) => assignment.roomId);
  const [rooms, roomTypes] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, id: { in: roomIds }, deletedAt: null },
      orderBy: { number: 'asc' },
    }),
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.roomId, assignment]));
  const roomTypeMap = new Map(roomTypes.map((roomType) => [roomType.id, roomType.name]));

  const items = rooms.map((room) => ({
    roomId: room.id,
    roomNumber: room.number,
    roomType: roomTypeMap.get(room.roomTypeId) ?? 'Room',
    housekeepingState: room.housekeepingStatus,
    stateVersion: room.stateVersion,
    taskTypes: assignmentMap.get(room.id)?.taskTypes ?? [],
  }));

  return NextResponse.json({ items });
}, 'HOUSEKEEPING');
