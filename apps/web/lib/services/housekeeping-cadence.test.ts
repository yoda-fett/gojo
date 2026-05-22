import { describe, expect, it } from 'vitest';

import {
  evaluateHousekeepingCadence,
  type CadenceReservation,
  type CadenceRoom,
} from './housekeeping-cadence';

// ── fixtures ────────────────────────────────────────────────────────────────

/** An IST instant from a `yyyy-MM-ddTHH:mm:ss` string. */
const ist = (s: string) => new Date(`${s}+05:30`);
/** The cadence run instant — 04:00 IST on a given day of May 2026. */
const runAt = (day: number) => ist(`2026-05-${String(day).padStart(2, '0')}T04:00:00`);

const cleanRoom: CadenceRoom = {
  housekeepingStatus: 'CLEAN',
  lastCadenceMarkedDate: null,
  createdAt: ist('2026-04-01T00:00:00'),
};

// Worked example (epic §3.1): a checkout on the 1st, x = 3.
const checkoutOn1st: CadenceReservation = {
  status: 'CHECKED_OUT',
  checkIn: ist('2026-04-28T12:00:00'),
  checkOut: ist('2026-05-01T11:00:00'),
};

const INTERVAL = 3;

describe('evaluateHousekeepingCadence — R3 periodic vacant (epic §3.1)', () => {
  it('does not fire on the days between the 3-day cadence', () => {
    for (const day of [2, 3, 5, 6, 8, 9]) {
      const decision = evaluateHousekeepingCadence(cleanRoom, [checkoutOn1st], [], INTERVAL, runAt(day));
      expect(decision).toEqual({ markDirty: false, reason: 'NO_RULE' });
    }
  });

  it('fires DIRTY every 3 days from the checkout anchor (4th, 7th, 10th, 13th, 16th, 19th)', () => {
    for (const day of [4, 7, 10, 13, 16, 19]) {
      const decision = evaluateHousekeepingCadence(cleanRoom, [checkoutOn1st], [], INTERVAL, runAt(day));
      expect(decision).toEqual({ markDirty: true, rule: 'R3' });
    }
  });

  it('anchors a never-occupied room on its createdAt date', () => {
    const newRoom: CadenceRoom = { ...cleanRoom, createdAt: ist('2026-05-01T10:00:00') };
    expect(evaluateHousekeepingCadence(newRoom, [], [], INTERVAL, runAt(4))).toEqual({
      markDirty: true,
      rule: 'R3',
    });
    expect(evaluateHousekeepingCadence(newRoom, [], [], INTERVAL, runAt(2))).toEqual({
      markDirty: false,
      reason: 'NO_RULE',
    });
  });

  it('honours a non-default interval', () => {
    // Interval 7 from the 1st → fires on the 8th, not the 4th.
    expect(evaluateHousekeepingCadence(cleanRoom, [checkoutOn1st], [], 7, runAt(4))).toEqual({
      markDirty: false,
      reason: 'NO_RULE',
    });
    expect(evaluateHousekeepingCadence(cleanRoom, [checkoutOn1st], [], 7, runAt(8))).toEqual({
      markDirty: true,
      rule: 'R3',
    });
  });
});

describe('evaluateHousekeepingCadence — R2 daily stayover (epic §3.1)', () => {
  // A guest checks in on the 11th for 4 nights (checkout the 15th).
  const stayover: CadenceReservation = {
    status: 'CHECKED_IN',
    checkIn: ist('2026-05-11T14:00:00'),
    checkOut: ist('2026-05-15T11:00:00'),
  };
  const reservations = [checkoutOn1st, stayover];

  it('does not fire on the check-in day itself', () => {
    expect(evaluateHousekeepingCadence(cleanRoom, reservations, [], INTERVAL, runAt(11))).toEqual({
      markDirty: false,
      reason: 'NO_RULE',
    });
  });

  it('fires DIRTY every day strictly after the check-in day (12th, 13th, 14th, 15th)', () => {
    for (const day of [12, 13, 14, 15]) {
      expect(evaluateHousekeepingCadence(cleanRoom, reservations, [], INTERVAL, runAt(day))).toEqual({
        markDirty: true,
        rule: 'R2',
      });
    }
  });

  it('R3 is suspended while the room is occupied — R2 owns an occupied room', () => {
    // The 13th would also be an R3 multiple from the 1st, but occupancy wins.
    expect(evaluateHousekeepingCadence(cleanRoom, reservations, [], INTERVAL, runAt(13))).toEqual({
      markDirty: true,
      rule: 'R2',
    });
  });
});

describe('evaluateHousekeepingCadence — R3 re-anchors after a new checkout', () => {
  // After the 15th checkout, max(checkOut) moves the anchor to the 15th.
  const reservations: CadenceReservation[] = [
    checkoutOn1st,
    { status: 'CHECKED_OUT', checkIn: ist('2026-05-11T14:00:00'), checkOut: ist('2026-05-15T11:00:00') },
  ];

  it('does not fire on the 16th/17th (within the new cycle)', () => {
    for (const day of [16, 17]) {
      expect(evaluateHousekeepingCadence(cleanRoom, reservations, [], INTERVAL, runAt(day))).toEqual({
        markDirty: false,
        reason: 'NO_RULE',
      });
    }
  });

  it('fires on the 18th, 21st, 24th (3-day cadence from the 15th)', () => {
    for (const day of [18, 21, 24]) {
      expect(evaluateHousekeepingCadence(cleanRoom, reservations, [], INTERVAL, runAt(day))).toEqual({
        markDirty: true,
        rule: 'R3',
      });
    }
  });
});

describe('evaluateHousekeepingCadence — skips', () => {
  it('skips a room already stamped for today (idempotency, AC-5)', () => {
    const stamped: CadenceRoom = {
      ...cleanRoom,
      lastCadenceMarkedDate: new Date('2026-05-04T00:00:00.000Z'),
    };
    // The 4th is an R3 firing day, but the stamp short-circuits it.
    expect(evaluateHousekeepingCadence(stamped, [checkoutOn1st], [], INTERVAL, runAt(4))).toEqual({
      markDirty: false,
      reason: 'ALREADY_MARKED_TODAY',
    });
  });

  it('still evaluates a room stamped on a previous day', () => {
    const stampedYesterday: CadenceRoom = {
      ...cleanRoom,
      lastCadenceMarkedDate: new Date('2026-05-03T00:00:00.000Z'),
    };
    expect(
      evaluateHousekeepingCadence(stampedYesterday, [checkoutOn1st], [], INTERVAL, runAt(4)),
    ).toEqual({ markDirty: true, rule: 'R3' });
  });

  it('skips a room with an active maintenance block (AC-2)', () => {
    const blocks = [
      {
        blockType: 'OUT_OF_ORDER',
        startDate: new Date('2026-05-02T00:00:00.000Z'),
        endDate: null,
        reason: 'Plumbing',
        deletedAt: null,
      },
    ];
    expect(evaluateHousekeepingCadence(cleanRoom, [checkoutOn1st], blocks, INTERVAL, runAt(4))).toEqual({
      markDirty: false,
      reason: 'ACTIVE_BLOCK',
    });
  });

  it('is unaffected by an expired (lifted) block', () => {
    const blocks = [
      {
        blockType: 'MAINTENANCE',
        startDate: new Date('2026-04-20T00:00:00.000Z'),
        endDate: new Date('2026-04-25T00:00:00.000Z'),
        reason: 'Repaint',
        deletedAt: null,
      },
    ];
    expect(evaluateHousekeepingCadence(cleanRoom, [checkoutOn1st], blocks, INTERVAL, runAt(4))).toEqual({
      markDirty: true,
      rule: 'R3',
    });
  });

  it('fires the rule even when the room is already DIRTY (the apply is a no-op)', () => {
    const dirtyRoom: CadenceRoom = { ...cleanRoom, housekeepingStatus: 'DIRTY' };
    expect(evaluateHousekeepingCadence(dirtyRoom, [checkoutOn1st], [], INTERVAL, runAt(4))).toEqual({
      markDirty: true,
      rule: 'R3',
    });
  });
});
