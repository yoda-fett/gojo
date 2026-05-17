import { AppError, type Actor } from '@gojo/types';

import type { Prisma } from './generated/client/index.js';
import { todayInIST } from './ist-calendar-day.js';
import { writeAuditLog } from './audit-log.js';

export type AssignmentTask = 'CLEAN' | 'REFILL' | 'STANDARD_LAUNDRY' | 'PERIODIC_LAUNDRY';

export const DEFAULT_ASSIGNMENT_TASKS: AssignmentTask[] = ['CLEAN', 'REFILL', 'STANDARD_LAUNDRY'];

export function assertDefaultAssignmentTasks(tasks: readonly string[]) {
  if (tasks.length !== DEFAULT_ASSIGNMENT_TASKS.length || tasks.some((task, index) => task !== DEFAULT_ASSIGNMENT_TASKS[index])) {
    throw new AppError('VALIDATION_ERROR', 'Default task bundle must be Clean, Refill, Standard Laundry', 422);
  }
}

export async function createRoomAssignment(
  actor: Actor,
  tx: Prisma.TransactionClient,
  input: { roomId: string; staffUserId: string; assignedDate?: Date },
) {
  const assignedDate = input.assignedDate ?? todayInIST();
  const staffAccess = await tx.propertyAccess.findFirst({
    where: {
      propertyId: actor.propertyId,
      userId: input.staffUserId,
      role: 'HOUSEKEEPING',
      status: 'ACTIVE',
      revokedAt: null,
      deletedAt: null,
    },
  });
  if (!staffAccess) {
    throw new AppError('INVALID_STAFF_USER', 'Staff user must be an active housekeeping user for this property', 422);
  }

  const room = await tx.room.findFirst({
    where: { id: input.roomId, propertyId: actor.propertyId, deletedAt: null },
    select: { id: true },
  });
  if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);

  const existing = await tx.roomAssignment.findFirst({
    where: {
      propertyId: actor.propertyId,
      roomId: input.roomId,
      assignedDate,
      deletedAt: null,
    },
  });
  if (existing) {
    throw new AppError('ROOM_ALREADY_ASSIGNED', 'Room already assigned', 409, {
      details: { code: 'ROOM_ALREADY_ASSIGNED', currentAssigneeId: existing.staffUserId },
    });
  }

  const assignment = await tx.roomAssignment.create({
    data: {
      propertyId: actor.propertyId,
      roomId: input.roomId,
      staffUserId: input.staffUserId,
      assignedDate,
      assignedBy: actor.userId,
      taskTypes: DEFAULT_ASSIGNMENT_TASKS,
    },
  });
  await writeAuditLog(tx, actor, {
    action: 'ROOM_ASSIGNED',
    entityType: 'ROOM_ASSIGNMENT',
    entityId: assignment.id,
    after: {
      roomId: input.roomId,
      staffUserId: input.staffUserId,
      assignedDate: assignedDate.toISOString(),
      taskTypes: DEFAULT_ASSIGNMENT_TASKS,
      actor: actor.userId,
    },
  });
  return assignment;
}

export async function reassignRoomAssignment(
  actor: Actor,
  tx: Prisma.TransactionClient,
  id: string,
  input: { staffUserId: string; stateVersion: number },
) {
  const before = await tx.roomAssignment.findFirst({
    where: { id, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!before) throw new AppError('NOT_FOUND', 'Room assignment not found', 404);
  if (before.stateVersion !== input.stateVersion) {
    throw new AppError('CONFLICT', 'Room assignment state version mismatch', 409, {
      details: { currentStateVersion: before.stateVersion },
    });
  }

  const staffAccess = await tx.propertyAccess.findFirst({
    where: {
      propertyId: actor.propertyId,
      userId: input.staffUserId,
      role: 'HOUSEKEEPING',
      status: 'ACTIVE',
      revokedAt: null,
      deletedAt: null,
    },
  });
  if (!staffAccess) throw new AppError('INVALID_STAFF_USER', 'Invalid housekeeping staff user', 422);

  const updated = await tx.roomAssignment.update({
    where: { id },
    data: { staffUserId: input.staffUserId, stateVersion: { increment: 1 } },
  });
  await writeAuditLog(tx, actor, {
    action: 'ROOM_REASSIGNED_STAFF',
    entityType: 'ROOM_ASSIGNMENT',
    entityId: id,
    before: before as unknown as Prisma.JsonObject,
    after: {
      roomId: before.roomId,
      fromStaffUserId: before.staffUserId,
      toStaffUserId: input.staffUserId,
      taskTypes: before.taskTypes,
      actor: actor.userId,
    },
  });
  return updated;
}

export async function deleteRoomAssignment(
  actor: Actor,
  tx: Prisma.TransactionClient,
  id: string,
  stateVersion?: number,
) {
  const before = await tx.roomAssignment.findFirst({
    where: { id, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!before) throw new AppError('NOT_FOUND', 'Room assignment not found', 404);
  if (stateVersion !== undefined && before.stateVersion !== stateVersion) {
    throw new AppError('CONFLICT', 'Room assignment state version mismatch', 409, {
      details: { currentStateVersion: before.stateVersion },
    });
  }
  const updated = await tx.roomAssignment.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: actor.userId, stateVersion: { increment: 1 } },
  });
  await writeAuditLog(tx, actor, {
    action: 'ROOM_ASSIGNMENT_DELETED',
    entityType: 'ROOM_ASSIGNMENT',
    entityId: id,
    before: before as unknown as Prisma.JsonObject,
    after: updated as unknown as Prisma.JsonObject,
  });
  return updated;
}
