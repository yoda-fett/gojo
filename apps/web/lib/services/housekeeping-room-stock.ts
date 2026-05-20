import { checkSubscriptionGate, prisma, scopedClient, todayInIST, withIdempotency, writeAuditLog } from '@gojo/db';
import { AppError, type Actor } from '@gojo/types';
import { z } from 'zod';

type AmenityStock = { catalogItemId: string; stocked: number; consumed: number; writeOffs: number };

const ownerRoles = ['OWNER', 'MANAGER'] as const;

const RefillBulkSchema = z
  .object({
    roomIds: z.array(z.string().min(1)).min(1),
    staffUserId: z.string().min(1).optional().nullable(),
    idempotencyKey: z.string().min(1).optional(),
  })
  .strict();

type RoomAssignmentRow = {
  id: string;
  roomId: string;
  staffUserId: string;
  taskTypes: string[];
};

function assertOwnerOrManager(actor: Actor) {
  if (!ownerRoles.includes(actor.role as (typeof ownerRoles)[number])) {
    throw new AppError('FORBIDDEN', 'Owner or manager role required', 403);
  }
}

function parseRefillBulk(raw: unknown) {
  const result = RefillBulkSchema.safeParse(raw);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new AppError('VALIDATION_ERROR', 'Invalid refill generation payload', 422, {
    details: { field: issue?.path.join('.') || 'body', reason: issue?.code ?? 'INVALID_PAYLOAD' },
  });
}

function storageStatus(level: number) {
  if (level <= 0) return 'Out';
  if (level <= 5) return 'Low';
  return 'Healthy';
}

function sumByItem<T extends { catalogItemId: string }>(rows: T[], read: (row: T) => number) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.catalogItemId, (totals.get(row.catalogItemId) ?? 0) + read(row));
  return totals;
}

export function calculateStorageAvailability(input: AmenityStock) {
  const level = input.stocked - input.consumed - input.writeOffs;
  return { level, status: storageStatus(level) };
}

export function appendRefillTask(taskTypes: string[]) {
  return taskTypes.includes('REFILL') ? taskTypes : [...taskTypes, 'REFILL'];
}

export async function getRoomStock(actor: Actor) {
  const [rooms, roomTypes, amenities, states, restocks, consumptions, writeOffs, staff] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, roomTypeId: true },
    }),
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.catalogItem.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, itemType: 'AMENITY' },
      orderBy: [{ roomTypeId: 'asc' }, { name: 'asc' }],
      select: { id: true, roomTypeId: true, name: true, unit: true, expectedQtyPerStay: true },
    }),
    prisma.roomConsumableState.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { roomId: true, catalogItemId: true, lastRefillAt: true },
    }),
    prisma.inventoryRestock.findMany({ where: { propertyId: actor.propertyId }, select: { catalogItemId: true, qtyAdded: true } }),
    prisma.consumptionLog.findMany({ where: { propertyId: actor.propertyId }, select: { catalogItemId: true, qtyUsed: true } }),
    prisma.consumableWriteOff.findMany({ where: { propertyId: actor.propertyId }, select: { catalogItemId: true, qty: true } }),
    prisma.propertyAccess.findMany({
      where: { propertyId: actor.propertyId, role: 'HOUSEKEEPING', status: 'ACTIVE', revokedAt: null, deletedAt: null },
      select: { userId: true },
    }),
  ]);

  const staffUsers = await prisma.user.findMany({
    where: { id: { in: staff.map((row) => row.userId) }, deletedAt: null },
    select: { id: true, name: true, phone: true },
  });
  const roomTypeMap = new Map(roomTypes.map((roomType) => [roomType.id, roomType.name]));
  const stateMap = new Map(states.map((state) => [`${state.roomId}:${state.catalogItemId}`, state]));
  const stocked = sumByItem(restocks, (row) => row.qtyAdded);
  const consumed = sumByItem(consumptions, (row) => row.qtyUsed);
  const losses = sumByItem(writeOffs, (row) => row.qty);

  return {
    canMutate: ownerRoles.includes(actor.role as (typeof ownerRoles)[number]),
    staff: staffUsers.map((user) => ({ id: user.id, name: user.name ?? user.phone, phone: user.phone })),
    rooms: rooms.map((room) => {
      const roomAmenities = amenities.filter((item) => item.roomTypeId === room.roomTypeId);
      return {
        roomId: room.id,
        roomNumber: room.number,
        roomType: roomTypeMap.get(room.roomTypeId) ?? 'Room',
        items: roomAmenities.map((item) => {
          const availability = calculateStorageAvailability({
            catalogItemId: item.id,
            stocked: stocked.get(item.id) ?? 0,
            consumed: consumed.get(item.id) ?? 0,
            writeOffs: losses.get(item.id) ?? 0,
          });
          const state = stateMap.get(`${room.id}:${item.id}`);
          return {
            catalogItemId: item.id,
            name: item.name,
            unit: item.unit,
            par: item.expectedQtyPerStay ?? 0,
            lastRefillAt: state?.lastRefillAt ?? null,
            storageAvailability: availability.status,
            storageLevel: availability.level,
          };
        }),
      };
    }),
  };
}

export async function generateRefillAssignments(actor: Actor, raw: unknown) {
  await checkSubscriptionGate(actor, 'room_assignment.write', prisma);
  assertOwnerOrManager(actor);
  const body = parseRefillBulk(raw);
  const roomIds = Array.from(new Set(body.roomIds));
  const key = body.idempotencyKey ?? `refill-bulk:${actor.propertyId}:${actor.userId}:${roomIds.sort().join(',')}:${body.staffUserId ?? 'existing'}`;

  return withIdempotency(key, prisma, async () =>
    prisma.$transaction(async (tx) => {
      const db = scopedClient(actor, tx);
      const assignedDate = todayInIST();
      const rooms = (await db.room.findMany({ where: { id: { in: roomIds } }, select: { id: true } })) as Array<{ id: string }>;
      if (rooms.length !== roomIds.length) throw new AppError('NOT_FOUND', 'One or more rooms were not found', 404);

      const existing = (await db.roomAssignment.findMany({
        where: { roomId: { in: roomIds }, assignedDate },
      })) as RoomAssignmentRow[];
      const existingByRoom = new Map(existing.map((assignment) => [assignment.roomId, assignment]));
      const missingRoomIds = roomIds.filter((roomId) => !existingByRoom.has(roomId));

      if (missingRoomIds.length > 0 && !body.staffUserId) {
        throw new AppError('VALIDATION_ERROR', 'staffUserId is required for unassigned rooms', 422, {
          details: { field: 'staffUserId', reason: 'REQUIRED_FOR_UNASSIGNED_ROOMS' },
        });
      }

      if (missingRoomIds.length > 0) {
        const staffAccess = await tx.propertyAccess.findFirst({
          where: {
            propertyId: actor.propertyId,
            userId: body.staffUserId ?? '',
            role: 'HOUSEKEEPING',
            status: 'ACTIVE',
            revokedAt: null,
            deletedAt: null,
          },
        });
        if (!staffAccess) throw new AppError('INVALID_STAFF_USER', 'Invalid housekeeping staff user', 422);
      }

      const affectedAssignmentIds: string[] = [];

      for (const assignment of existing) {
        const nextTaskTypes = appendRefillTask(assignment.taskTypes);
        if (nextTaskTypes.length === assignment.taskTypes.length) {
          affectedAssignmentIds.push(assignment.id);
          continue;
        }
        const updated = (await db.roomAssignment.update({
          where: { id: assignment.id },
          data: { taskTypes: nextTaskTypes, stateVersion: { increment: 1 } },
        })) as { id: string };
        affectedAssignmentIds.push(updated.id);
        await writeAuditLog(tx, actor, {
          action: 'ROOM_ASSIGNMENT_REFILL_APPENDED',
          entityType: 'ROOM_ASSIGNMENT',
          entityId: assignment.id,
          before: { taskTypes: assignment.taskTypes, staffUserId: assignment.staffUserId },
          after: { taskTypes: nextTaskTypes, staffUserId: assignment.staffUserId },
        });
      }

      for (const roomId of missingRoomIds) {
        const created = (await db.roomAssignment.create({
          data: {
            roomId,
            staffUserId: body.staffUserId,
            assignedDate,
            assignedBy: actor.userId,
            taskTypes: ['REFILL'],
          },
        })) as { id: string };
        affectedAssignmentIds.push(created.id);
        await writeAuditLog(tx, actor, {
          action: 'ROOM_ASSIGNMENT_REFILL_CREATED',
          entityType: 'ROOM_ASSIGNMENT',
          entityId: created.id,
          after: { roomId, staffUserId: body.staffUserId, assignedDate: assignedDate.toISOString(), taskTypes: ['REFILL'] },
        });
      }

      return { ok: true, assignmentIds: affectedAssignmentIds, roomIds };
    }),
  );
}
