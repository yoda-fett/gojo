// @ts-nocheck
import { redirect } from 'next/navigation';

import { istDateFromKey, prisma, todayInIST } from '@gojo/db';

import { AssignmentsClient } from '@/components/assignments/assignments-client';
import { getServerActor } from '@/lib/auth/server-actor';

export const dynamic = 'force-dynamic';

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');
  if (!['OWNER', 'MANAGER'].includes(actor.role)) redirect('/dashboard');

  const params = await searchParams;
  const assignedDate = params.date ? istDateFromKey(params.date) : todayInIST();
  const [rooms, roomTypes, assignments, access] = await Promise.all([
    prisma.room.findMany({ where: { propertyId: actor.propertyId, deletedAt: null }, orderBy: { number: 'asc' } }),
    prisma.roomType.findMany({ where: { propertyId: actor.propertyId, deletedAt: null }, select: { id: true, name: true } }),
    prisma.roomAssignment.findMany({ where: { propertyId: actor.propertyId, assignedDate, deletedAt: null } }),
    prisma.propertyAccess.findMany({
      where: { propertyId: actor.propertyId, role: 'HOUSEKEEPING', status: 'ACTIVE', revokedAt: null, deletedAt: null },
      select: { userId: true },
    }),
  ]);
  const users = await prisma.user.findMany({
    where: { id: { in: access.map((row) => row.userId) }, deletedAt: null },
    select: { id: true, name: true, phone: true },
  });

  const roomTypeMap = new Map(roomTypes.map((roomType) => [roomType.id, roomType.name]));
  const userMap = new Map(users.map((user) => [user.id, user.name ?? user.phone]));
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.roomId, assignment]));
  const rows = rooms.map((room) => {
    const assignment = assignmentMap.get(room.id);
    const base = {
      roomId: room.id,
      roomNumber: room.number,
      roomType: roomTypeMap.get(room.roomTypeId) ?? 'Room',
      housekeepingState: room.state,
    };
    if (!assignment) return { type: 'unassigned' as const, ...base };
    return {
      type: 'assigned' as const,
      ...base,
      assignmentId: assignment.id,
      staffUserId: assignment.staffUserId,
      staffName: userMap.get(assignment.staffUserId) ?? 'Unknown',
      taskTypes: assignment.taskTypes,
      stateVersion: assignment.stateVersion,
    };
  });

  return (
    <AssignmentsClient
      initialAssignments={rows.filter((row) => row.type === 'assigned').map(({ type: _type, ...row }) => row)}
      initialUnassigned={rows.filter((row) => row.type === 'unassigned').map(({ type: _type, ...row }) => row)}
      staff={users.map((user) => ({ id: user.id, name: user.name ?? '', phone: user.phone }))}
    />
  );
}
