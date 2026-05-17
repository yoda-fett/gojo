import { describe, expect, it, vi } from 'vitest';

import { checkDowngradeBlockers } from '../downgrade-blockers.js';

interface FakeDbOptions {
  channels: number;
  directBookingEnabled: boolean;
  rateOverrideCount: number;
}

function fakeDb(opts: FakeDbOptions) {
  return {
    channel: {
      count: vi.fn(async () => opts.channels),
    },
    property: {
      findUnique: vi.fn(async () => ({ directBookingEnabled: opts.directBookingEnabled })),
    },
    auditLog: {
      count: vi.fn(async () => opts.rateOverrideCount),
    },
  } as never;
}

describe('checkDowngradeBlockers', () => {
  it('flags active OTA channels when target tier does not include channel.connect (STARTER)', async () => {
    const db = fakeDb({ channels: 2, directBookingEnabled: false, rateOverrideCount: 0 });
    const blockers = await checkDowngradeBlockers(db, 'p1', 'STARTER');
    expect(blockers.find((b) => b.feature === 'ota_channels')).toBeTruthy();
    expect(blockers.find((b) => b.feature === 'ota_channels')?.reason).toMatch(/2 OTA channels/);
  });

  it('does NOT flag OTA channels when target tier is GROWTH (still includes channel.connect)', async () => {
    const db = fakeDb({ channels: 5, directBookingEnabled: false, rateOverrideCount: 0 });
    const blockers = await checkDowngradeBlockers(db, 'p1', 'GROWTH');
    expect(blockers.find((b) => b.feature === 'ota_channels')).toBeFalsy();
  });

  it('does NOT flag direct booking when STARTER (both STARTER + GROWTH include direct_booking.enable)', async () => {
    const db = fakeDb({ channels: 0, directBookingEnabled: true, rateOverrideCount: 0 });
    const blockers = await checkDowngradeBlockers(db, 'p1', 'STARTER');
    expect(blockers.find((b) => b.feature === 'direct_booking')).toBeFalsy();
  });

  it('flags below-floor overrides only when downgrading away from GROWTH', async () => {
    const db = fakeDb({ channels: 0, directBookingEnabled: false, rateOverrideCount: 3 });
    const toStarter = await checkDowngradeBlockers(db, 'p1', 'STARTER');
    expect(toStarter.find((b) => b.feature === 'rate_override_below_floor')).toBeTruthy();
  });

  it('returns empty when no blockers exist', async () => {
    const db = fakeDb({ channels: 0, directBookingEnabled: false, rateOverrideCount: 0 });
    const blockers = await checkDowngradeBlockers(db, 'p1', 'STARTER');
    expect(blockers).toEqual([]);
  });
});
