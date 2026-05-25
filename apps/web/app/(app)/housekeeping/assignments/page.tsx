// @ts-nocheck
import { redirect } from 'next/navigation';

import { istDateFromKey, prisma, todayInIST } from '@gojo/db';

import { AssignmentsClient } from '@/components/assignments/assignments-client';
import { getServerActor } from '@/lib/auth/server-actor';

export const dynamic = 'force-dynamic';

// Hotfix-8 Phase D: feeds the per-staff bucket layout in AssignmentsClient.
// Derives task chips from housekeepingStatus for unassigned rooms (the assignment
// itself carries taskTypes once a staff is picked). Surfaces shift windows for
// non-owner roles only — owners/co-owners carry the shift columns for parity
// but never display them per Owner direction (2026-05-25).
const OWNER_ROLES = new Set(['OWNER', 'CO_OWNER']);
const DEFAULT_BUNDLE_DIRTY = ['CLEAN', 'REFILL', 'STANDARD_LAUNDRY'];
const DEFAULT_BUNDLE_CLEAN = ['REFILL'];

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
      select: { userId: true, role: true, shiftStart: true, shiftEnd: true },
    }),
  ]);
  const users = await prisma.user.findMany({
    where: { id: { in: access.map((row) => row.userId) }, deletedAt: null },
    select: { id: true, name: true, phone: true },
  });

  const roomTypeMap = new Map(roomTypes.map((roomType) => [roomType.id, roomType.name]));
  const userMap = new Map(users.map((user) => [user.id, user]));
  const accessByUserId = new Map(access.map((a) => [a.userId, a]));
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.roomId, assignment]));

  function initials(name: string) {
    return (
      name
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'ST'
    );
  }

  function deriveTasks(housekeepingStatus: string) {
    return housekeepingStatus === 'DIRTY' ? DEFAULT_BUNDLE_DIRTY : DEFAULT_BUNDLE_CLEAN;
  }

  const rows = rooms.map((room) => {
    const assignment = assignmentMap.get(room.id);
    const base = {
      roomId: room.id,
      roomNumber: room.number,
      roomType: roomTypeMap.get(room.roomTypeId) ?? 'Room',
      housekeepingState: room.housekeepingStatus,
      derivedTasks: deriveTasks(room.housekeepingStatus),
    };
    if (!assignment) return { type: 'unassigned' as const, ...base };
    const user = userMap.get(assignment.staffUserId);
    const name = user?.name?.trim() || user?.phone || 'Staff';
    return {
      type: 'assigned' as const,
      ...base,
      assignmentId: assignment.id,
      staffUserId: assignment.staffUserId,
      staffName: name,
      taskTypes: assignment.taskTypes,
      stateVersion: assignment.stateVersion,
    };
  });

  const unassignedRows = rows.filter((row) => row.type === 'unassigned').map(({ type: _type, ...row }) => row);
  const assignedRows = rows.filter((row) => row.type === 'assigned').map(({ type: _type, ...row }) => row);

  // Task mix today: count rooms (assigned or unassigned) by task across the
  // operational set (dirty + occupied/dirty). For assigned rooms we trust the
  // recorded taskTypes; for unassigned we use the derived bundle.
  const taskMix = { CLEAN: 0, REFILL: 0, STANDARD_LAUNDRY: 0, PERIODIC_LAUNDRY: 0 };
  for (const row of rows) {
    const tasks: string[] = row.type === 'assigned' ? row.taskTypes : row.derivedTasks;
    for (const t of tasks) {
      if (t in taskMix) (taskMix as Record<string, number>)[t] += 1;
    }
  }

  const counts = {
    needingService: rows.filter((r) => r.housekeepingState === 'DIRTY').length,
    assigned: assignedRows.length,
    unassigned: unassignedRows.length,
    taskMix,
  };

  const staff = users.map((user) => {
    const a = accessByUserId.get(user.id);
    const isOwner = OWNER_ROLES.has(a?.role ?? '');
    return {
      id: user.id,
      name: user.name?.trim() || user.phone,
      phone: user.phone,
      initials: initials(user.name?.trim() || user.phone),
      // Hide shift for owner roles per Owner direction (2026-05-25): backend
      // carries the columns but the UI must never display them.
      shiftStart: isOwner ? null : (a?.shiftStart ?? '08:00'),
      shiftEnd: isOwner ? null : (a?.shiftEnd ?? '17:00'),
    };
  });

  return (
    <AssignmentsClient
      initialAssignments={assignedRows}
      initialUnassigned={unassignedRows}
      staff={staff}
      counts={counts}
    />
  );
}
