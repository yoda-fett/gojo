// Story 15.7 — Housekeeping cadence engine (pure evaluator).
//
// Implements the two *scheduled* DIRTY rules from epic §3:
//   R2 — daily stayover: an OCCUPIED room, every IST day after the check-in day.
//   R3 — periodic vacant: a VACANT room, every `routineCleaningIntervalDays`
//        since its last checkout (the cycle anchor).
//
// R1 (checkout) and R4 (block lift) are event-driven and already wired
// (reservation-service check-out / room-blocks sweepExpiredBlocks).
//
// This file is the pure, DB-free, unit-tested core; the DB-backed job loop
// that drives it lives in `housekeeping-cadence-job.ts`.

import { hasActiveBlock, istDateKey, istDateFromKey, type RoomStatusBlock } from '@gojo/db';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CadenceRoom {
  /** `CLEAN | DIRTY` — stored housekeeping axis. */
  housekeepingStatus: string;
  /** IST-date idempotency stamp (`@db.Date`, UTC-midnight of the IST day). */
  lastCadenceMarkedDate: Date | null;
  /** Fallback R3 anchor for a room that has never been occupied. */
  createdAt: Date;
}

export interface CadenceReservation {
  status: string; // CHECKED_IN | CHECKED_OUT (others are irrelevant to cadence)
  checkIn: Date;
  checkOut: Date;
}

export type CadenceDecision =
  | { markDirty: true; rule: 'R2' | 'R3' }
  | { markDirty: false; reason: 'ALREADY_MARKED_TODAY' | 'ACTIVE_BLOCK' | 'NO_RULE' };

/** Whole IST days between two `yyyy-MM-dd` keys (`toKey - fromKey`). */
function istDayDiff(fromKey: string, toKey: string): number {
  return Math.round(
    (istDateFromKey(toKey).getTime() - istDateFromKey(fromKey).getTime()) / DAY_MS,
  );
}

/**
 * Decide whether one room should be flagged `DIRTY` by the cadence engine.
 *
 * Pure — no DB, no clock beyond the injected `now`. Precedence:
 *   1. an active maintenance block → skip (AC-2)
 *   2. already stamped for today's IST date → skip (AC-5 idempotency)
 *   3. OCCUPIED → R2 (every day strictly after the check-in day)
 *   4. VACANT  → R3 (daysSince(anchor) a positive multiple of the interval)
 */
export function evaluateHousekeepingCadence(
  room: CadenceRoom,
  reservations: CadenceReservation[],
  blocks: RoomStatusBlock[],
  routineCleaningIntervalDays: number,
  now: Date = new Date(),
): CadenceDecision {
  const todayKey = istDateKey(now);

  // AC-2 — out-of-service rooms are skipped entirely.
  if (hasActiveBlock(blocks, now)) {
    return { markDirty: false, reason: 'ACTIVE_BLOCK' };
  }

  // AC-5 — idempotency: a room already stamped for today's IST date is skipped.
  if (room.lastCadenceMarkedDate && istDateKey(room.lastCadenceMarkedDate) === todayKey) {
    return { markDirty: false, reason: 'ALREADY_MARKED_TODAY' };
  }

  // Occupancy — OCCUPIED iff a CHECKED_IN reservation exists (matches deriveRoomStatus).
  const checkedIn = reservations.find((r) => r.status === 'CHECKED_IN') ?? null;

  if (checkedIn) {
    // R2 — daily stayover: every IST day strictly after the check-in day.
    if (istDayDiff(istDateKey(checkedIn.checkIn), todayKey) > 0) {
      return { markDirty: true, rule: 'R2' };
    }
    return { markDirty: false, reason: 'NO_RULE' };
  }

  // R3 — periodic vacant. Anchor = max(checkOut) over CHECKED_OUT reservations
  // (any checkout resets the cycle), falling back to room.createdAt when the
  // room has never been occupied.
  const lastCheckOut = reservations
    .filter((r) => r.status === 'CHECKED_OUT')
    .reduce<Date | null>((max, r) => (max == null || r.checkOut > max ? r.checkOut : max), null);
  const anchorKey = istDateKey(lastCheckOut ?? room.createdAt);
  const daysSince = istDayDiff(anchorKey, todayKey);
  if (daysSince > 0 && daysSince % routineCleaningIntervalDays === 0) {
    return { markDirty: true, rule: 'R3' };
  }
  return { markDirty: false, reason: 'NO_RULE' };
}
