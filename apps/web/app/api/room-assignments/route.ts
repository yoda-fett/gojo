// @ts-nocheck
import {
  checkSubscriptionGate,
  createRoomAssignment,
  istDateFromKey,
  prisma,
  todayInIST,
} from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';

const Body = z.object({
  roomId: z.string().min(1),
  staffUserId: z.string().min(1),
});

function dateFromParam(value: string | null) {
  if (!value) return todayInIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError('VALIDATION_ERROR', 'date must use yyyy-MM-dd', 422);
  }
  return istDateFromKey(value);
}

export const POST = withAuth(async (req, actor) => {
  await checkSubscriptionGate(actor, 'room_assignment.create', prisma);
  const body = Body.parse(await req.json());
  const assignment = await prisma.$transaction((tx) => createRoomAssignment(actor, tx, body));
  return NextResponse.json({ ok: true, assignment }, { status: 201 });
}, ['OWNER', 'MANAGER']);

export const GET = withAuth(async (req, actor) => {
  const assignedDate = dateFromParam(new URL(req.url).searchParams.get('date'));
  const [rooms, roomTypes, assignments] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { number: 'asc' },
    }),
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.roomAssignment.findMany({
      where: { propertyId: actor.propertyId, assignedDate, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const staffIds = Array.from(new Set(assignments.map((assignment) => assignment.staffUserId)));
  const staff = await prisma.user.findMany({
    where: { id: { in: staffIds }, deletedAt: null },
    select: { id: true, name: true, phone: true },
  });
  const roomTypeMap = new Map(roomTypes.map((roomType) => [roomType.id, roomType.name]));
  const staffMap = new Map(staff.map((user) => [user.id, user.name ?? user.phone]));
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.roomId, assignment]));

  const mapped = rooms.map((room) => {
    const assignment = assignmentMap.get(room.id);
    const base = {
      roomId: room.id,
      roomNumber: room.number,
      roomType: roomTypeMap.get(room.roomTypeId) ?? 'Room',
      housekeepingState: room.state,
    };
    if (!assignment) return { kind: 'unassigned' as const, ...base };
    return {
      kind: 'assigned' as const,
      ...base,
      assignmentId: assignment.id,
      stateVersion: assignment.stateVersion,
      staffUserId: assignment.staffUserId,
      staffName: staffMap.get(assignment.staffUserId) ?? 'Unknown',
      taskTypes: assignment.taskTypes,
    };
  });

  return NextResponse.json({
    assignments: mapped.filter((row) => row.kind === 'assigned').map(({ kind: _kind, ...row }) => row),
    unassigned: mapped.filter((row) => row.kind === 'unassigned').map(({ kind: _kind, ...row }) => row),
  });
}, ['OWNER', 'MANAGER']);
