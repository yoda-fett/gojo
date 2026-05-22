import { describe, expect, it } from 'vitest';

import { deriveRoomStatus } from '../room-status.js';

// 2026-05-22 ~11:30 IST — `istDateKey` resolves this to '2026-05-22'.
const NOW = new Date('2026-05-22T06:00:00.000Z');

function res(
  status: string,
  checkInKey: string,
  checkOutKey: string,
  extra: Record<string, unknown> = {},
) {
  return {
    status,
    checkIn: new Date(`${checkInKey}T00:00:00+05:30`),
    checkOut: new Date(`${checkOutKey}T00:00:00+05:30`),
    ...extra,
  };
}

function block(blockType: string, fromKey: string, toKey: string | null) {
  return {
    blockType,
    startDate: new Date(`${fromKey}T00:00:00+05:30`),
    endDate: toKey ? new Date(`${toKey}T00:00:00+05:30`) : null,
    reason: 'Plumbing',
    deletedAt: null,
  };
}

describe('deriveRoomStatus — solution model §5 scenarios', () => {
  it('an open-ended out-of-order block overrides every other axis', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'CLEAN' },
      [res('CHECKED_IN', '2026-05-20', '2026-05-25')],
      [block('OUT_OF_ORDER', '2026-05-20', null)],
      NOW,
    );
    expect(s.display).toBe('OUT_OF_ORDER');
    expect(s.outOfService?.to).toBeNull();
  });

  it('a dated maintenance block resolves to MAINTENANCE', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'DIRTY' },
      [],
      [block('MAINTENANCE', '2026-05-22', '2026-05-25')],
      NOW,
    );
    expect(s.display).toBe('MAINTENANCE');
  });

  it('an in-house mid-stay guest → IN_HOUSE with Night X of Y', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'CLEAN' },
      [res('CHECKED_IN', '2026-05-20', '2026-05-25')],
      [],
      NOW,
    );
    expect(s.display).toBe('IN_HOUSE');
    expect(s.occupancy).toBe('OCCUPIED');
    expect(s.timeline.nightNumber).toBe(3);
    expect(s.timeline.totalNights).toBe(5);
  });

  it('an in-house guest checking out today → DEPARTING, housekeeping shown independently', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'DIRTY' },
      [res('CHECKED_IN', '2026-05-19', '2026-05-22')],
      [],
      NOW,
    );
    expect(s.display).toBe('DEPARTING');
    expect(s.housekeeping).toBe('DIRTY');
  });

  it('a vacant room with a CONFIRMED arrival today → ARRIVING', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'CLEAN' },
      [res('CONFIRMED', '2026-05-22', '2026-05-24')],
      [],
      NOW,
    );
    expect(s.display).toBe('ARRIVING');
    expect(s.occupancy).toBe('VACANT');
  });

  it('a vacant room with a live hold → HELD', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'CLEAN', holdExpiresAt: new Date(NOW.getTime() + 5 * 60_000) },
      [],
      [],
      NOW,
    );
    expect(s.display).toBe('HELD');
    expect(s.held).toBe(true);
  });

  it('an expired hold is not held — falls through to AVAILABLE', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'CLEAN', holdExpiresAt: new Date(NOW.getTime() - 60_000) },
      [],
      [],
      NOW,
    );
    expect(s.held).toBe(false);
    expect(s.display).toBe('AVAILABLE');
  });

  it('a vacant dirty room → DIRTY', () => {
    const s = deriveRoomStatus({ housekeepingStatus: 'DIRTY' }, [], [], NOW);
    expect(s.display).toBe('DIRTY');
    expect(s.occupancy).toBe('VACANT');
  });

  it('a vacant clean room with a future booking → AVAILABLE + reserved', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'CLEAN' },
      [res('CONFIRMED', '2026-05-28', '2026-05-30')],
      [],
      NOW,
    );
    expect(s.display).toBe('AVAILABLE');
    expect(s.reserved).toBe(true);
    expect(s.timeline.nextArrival).not.toBeNull();
  });

  it('same-day turnover: occupancy outranks a same-day arrival (Departing wins)', () => {
    const s = deriveRoomStatus(
      { housekeepingStatus: 'CLEAN' },
      [
        res('CHECKED_IN', '2026-05-19', '2026-05-22'),
        res('CONFIRMED', '2026-05-22', '2026-05-24'),
      ],
      [],
      NOW,
    );
    expect(s.display).toBe('DEPARTING');
  });

  it('a deleted block is ignored', () => {
    const stale = { ...block('OUT_OF_ORDER', '2026-05-20', null), deletedAt: new Date('2026-05-21T00:00:00Z') };
    const s = deriveRoomStatus({ housekeepingStatus: 'CLEAN' }, [], [stale], NOW);
    expect(s.outOfService).toBeNull();
    expect(s.display).toBe('AVAILABLE');
  });
});
