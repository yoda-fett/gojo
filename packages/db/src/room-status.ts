// Epic 15 — the single source of truth for composed room status.
//
// Pure function: takes already-loaded rows and returns the derived composition.
// No DB calls. Lives in @gojo/db so both the web app and the housekeeping
// companion app render room status identically (solution model §3).

import { istDateKey, istDateFromKey } from './ist-calendar-day.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export type Housekeeping = 'CLEAN' | 'DIRTY';
export type Occupancy = 'OCCUPIED' | 'VACANT';

/** The primary chip — resolved by the §3 precedence ladder. */
export type RoomDisplayState =
  | 'OUT_OF_ORDER'
  | 'MAINTENANCE'
  | 'IN_HOUSE'
  | 'DEPARTING'
  | 'ARRIVING'
  | 'HELD'
  | 'AVAILABLE'
  | 'DIRTY';

export interface RoomStatusRoom {
  housekeepingStatus: string;
  holdExpiresAt?: Date | null;
}

export interface RoomStatusReservation {
  id?: string;
  status: string; // CONFIRMED | CHECKED_IN | CHECKED_OUT | CANCELLED | NO_SHOW
  checkIn: Date;
  checkOut: Date;
  guestName?: string | null;
  bookingReference?: string | null;
}

export interface RoomStatusBlock {
  blockType: string; // OUT_OF_ORDER | MAINTENANCE
  startDate: Date;
  endDate: Date | null; // null = open-ended
  reason: string;
  deletedAt?: Date | null;
}

export interface RoomStatus {
  housekeeping: Housekeeping; // stored, passed through
  occupancy: Occupancy; // derived
  reserved: boolean; // derived — has a forward CONFIRMED booking
  held: boolean; // derived — holdExpiresAt > now
  outOfService: { type: string; reason: string; from: Date; to: Date | null } | null;
  timeline: {
    arrivingToday: boolean;
    departingToday: boolean;
    nightNumber: number | null;
    totalNights: number | null;
    currentReservation: RoomStatusReservation | null;
    nextArrival: RoomStatusReservation | null;
    lastGuest: RoomStatusReservation | null;
  };
  display: RoomDisplayState;
}

/**
 * Derive the composed status of one room from already-loaded data.
 *
 * Occupancy and "reserved" come from the reservation rows; "held" from the
 * hold timestamp; out-of-service from active blocks. Housekeeping is the only
 * stored axis and is passed through untouched. The `display` token follows the
 * fixed precedence ladder in solution model §3.
 */
export function deriveRoomStatus(
  room: RoomStatusRoom,
  reservations: RoomStatusReservation[],
  blocks: RoomStatusBlock[],
  now: Date = new Date(),
): RoomStatus {
  const housekeeping: Housekeeping = room.housekeepingStatus === 'DIRTY' ? 'DIRTY' : 'CLEAN';
  const todayKey = istDateKey(now);

  // ── Occupancy — OCCUPIED iff a CHECKED_IN reservation exists for the room.
  const checkedIn = reservations.find((r) => r.status === 'CHECKED_IN') ?? null;
  const occupancy: Occupancy = checkedIn ? 'OCCUPIED' : 'VACANT';

  // ── Held — purely time-derived; no stored flag.
  const held = !!room.holdExpiresAt && room.holdExpiresAt.getTime() > now.getTime();

  // ── Out of service — earliest active (non-deleted, covers today) block.
  const activeBlock =
    blocks
      .filter((b) => !b.deletedAt)
      .filter(
        (b) =>
          istDateKey(b.startDate) <= todayKey &&
          (b.endDate == null || istDateKey(b.endDate) >= todayKey),
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ?? null;
  const outOfService = activeBlock
    ? {
        type: activeBlock.blockType,
        reason: activeBlock.reason,
        from: activeBlock.startDate,
        to: activeBlock.endDate,
      }
    : null;

  // ── Forward bookings — CONFIRMED reservations not yet checked in.
  const confirmed = reservations
    .filter((r) => r.status === 'CONFIRMED')
    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
  const arrivingReservation = confirmed.find((r) => istDateKey(r.checkIn) === todayKey) ?? null;
  const nextArrival = confirmed.find((r) => istDateKey(r.checkIn) >= todayKey) ?? null;
  const reserved = nextArrival != null;

  // ── Timeline.
  const arrivingToday = arrivingReservation != null;
  const departingToday = checkedIn != null && istDateKey(checkedIn.checkOut) === todayKey;

  const lastGuest =
    reservations
      .filter((r) => r.status === 'CHECKED_OUT')
      .sort((a, b) => b.checkOut.getTime() - a.checkOut.getTime())[0] ?? null;

  let nightNumber: number | null = null;
  let totalNights: number | null = null;
  if (checkedIn) {
    const ciKey = istDateKey(checkedIn.checkIn);
    const coKey = istDateKey(checkedIn.checkOut);
    totalNights = Math.max(
      1,
      Math.round((istDateFromKey(coKey).getTime() - istDateFromKey(ciKey).getTime()) / DAY_MS),
    );
    const elapsed = Math.round(
      (istDateFromKey(todayKey).getTime() - istDateFromKey(ciKey).getTime()) / DAY_MS,
    );
    nightNumber = Math.min(totalNights, Math.max(1, elapsed + 1));
  }

  // ── Display precedence ladder (solution model §3).
  let display: RoomDisplayState;
  if (outOfService) {
    display = outOfService.type === 'MAINTENANCE' ? 'MAINTENANCE' : 'OUT_OF_ORDER';
  } else if (occupancy === 'OCCUPIED') {
    display = departingToday ? 'DEPARTING' : 'IN_HOUSE';
  } else if (arrivingToday) {
    display = 'ARRIVING';
  } else if (held) {
    display = 'HELD';
  } else {
    display = housekeeping === 'DIRTY' ? 'DIRTY' : 'AVAILABLE';
  }

  return {
    housekeeping,
    occupancy,
    reserved,
    held,
    outOfService,
    timeline: {
      arrivingToday,
      departingToday,
      nightNumber,
      totalNights,
      currentReservation: checkedIn,
      nextArrival,
      lastGuest,
    },
    display,
  };
}

/** Convenience: is a room out of service today (an active block covers today)? */
export function hasActiveBlock(blocks: RoomStatusBlock[], now: Date = new Date()): boolean {
  const todayKey = istDateKey(now);
  return blocks.some(
    (b) =>
      !b.deletedAt &&
      istDateKey(b.startDate) <= todayKey &&
      (b.endDate == null || istDateKey(b.endDate) >= todayKey),
  );
}
