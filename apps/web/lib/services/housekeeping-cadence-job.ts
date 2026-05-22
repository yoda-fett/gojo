// @ts-nocheck
// Story 15.7 — Housekeeping cadence engine (DB-backed job loop).
//
// Scans every active property and applies the pure R2/R3 evaluator
// (`housekeeping-cadence.ts`) to every non-deleted room. Driven by the daily
// `POST /api/internal/housekeeping-cadence` cron endpoint.

import { istDateKey, prisma, type RoomStatusBlock } from '@gojo/db';
import { AppError } from '@gojo/types';

import { evaluateHousekeepingCadence } from './housekeeping-cadence';

export interface CadenceSummary {
  propertiesScanned: number;
  roomsEvaluated: number;
  markedDirty: number;
  skipped: number;
}

function groupByRoom(rows) {
  const map = new Map();
  for (const row of rows) {
    const bucket = map.get(row.roomId);
    if (bucket) bucket.push(row);
    else map.set(row.roomId, [row]);
  }
  return map;
}

/**
 * `stateVersion`-guarded DIRTY write + idempotency stamp (AC-6). A concurrent
 * mutation (e.g. a housekeeper marking the room CLEAN) bumps `stateVersion`,
 * the guarded `updateMany` then matches zero rows, and a `CONFLICT` is thrown
 * for the caller to catch — the room is simply re-evaluated next run.
 */
async function applyCadenceMark(room, todayStamp: Date) {
  const updated = await prisma.room.updateMany({
    where: {
      id: room.id,
      propertyId: room.propertyId,
      stateVersion: room.stateVersion,
      deletedAt: null,
    },
    data: {
      housekeepingStatus: 'DIRTY',
      lastCadenceMarkedDate: todayStamp,
      stateVersion: { increment: 1 },
    },
  });
  if (updated.count === 0) {
    throw new AppError('CONFLICT', `Room ${room.id} stateVersion mismatch`, 409);
  }
}

/**
 * Scan every active property and apply R2/R3 to every non-deleted room.
 * Rooms with an active maintenance block are skipped; a per-room `CONFLICT`
 * is caught so one lost race never aborts the batch (AC-6).
 */
export async function runHousekeepingCadence(now: Date = new Date()): Promise<CadenceSummary> {
  const summary: CadenceSummary = {
    propertiesScanned: 0,
    roomsEvaluated: 0,
    markedDirty: 0,
    skipped: 0,
  };

  // AC-5 — the IST-date idempotency stamp, stored as UTC-midnight so it
  // round-trips through `istDateKey` regardless of `@db.Date` truncation.
  const todayStamp = new Date(`${istDateKey(now)}T00:00:00.000Z`);

  const properties = await prisma.property.findMany({
    where: { deletedAt: null, active: true },
    select: { id: true, routineCleaningIntervalDays: true },
  });

  for (const property of properties) {
    summary.propertiesScanned += 1;

    const rooms = await prisma.room.findMany({
      where: { propertyId: property.id, deletedAt: null },
      select: {
        id: true,
        propertyId: true,
        housekeepingStatus: true,
        lastCadenceMarkedDate: true,
        stateVersion: true,
        createdAt: true,
      },
    });
    if (rooms.length === 0) continue;
    const roomIds = rooms.map((r) => r.id);

    const [reservations, blocks] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          propertyId: property.id,
          roomId: { in: roomIds },
          status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
        },
        select: { roomId: true, status: true, checkIn: true, checkOut: true },
      }),
      prisma.roomBlock.findMany({
        where: { propertyId: property.id, roomId: { in: roomIds }, deletedAt: null },
        select: {
          roomId: true,
          blockType: true,
          startDate: true,
          endDate: true,
          reason: true,
          deletedAt: true,
        },
      }),
    ]);

    const reservationsByRoom = groupByRoom(reservations);
    const blocksByRoom = groupByRoom(blocks);

    for (const room of rooms) {
      summary.roomsEvaluated += 1;
      const decision = evaluateHousekeepingCadence(
        room,
        reservationsByRoom.get(room.id) ?? [],
        (blocksByRoom.get(room.id) ?? []) as RoomStatusBlock[],
        property.routineCleaningIntervalDays,
        now,
      );

      if (!decision.markDirty) {
        summary.skipped += 1;
        continue;
      }

      try {
        await applyCadenceMark(room, todayStamp);
        summary.markedDirty += 1;
      } catch (err) {
        // A room losing a `stateVersion` race is re-evaluated next run —
        // never abort the batch (AC-6).
        if (err instanceof AppError && err.code === 'CONFLICT') {
          summary.skipped += 1;
          continue;
        }
        throw err;
      }
    }
  }

  return summary;
}
