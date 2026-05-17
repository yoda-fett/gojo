import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, PLAN_CONFIG } from '@gojo/types';

import {
  checkSubscriptionGate,
  invalidateSubscriptionCache,
} from '../subscription-gate.js';
import { resetDbRedisForTests } from '../redis.js';

interface FakeSub {
  tier: 'TRIAL' | 'STARTER' | 'GROWTH';
  status: 'TRIAL' | 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELLED';
}

function fakeDb(sub: FakeSub | null) {
  const findUnique = vi.fn(async () => sub);
  return {
    db: { subscription: { findUnique } } as never,
    findUnique,
  };
}

const actor = { propertyId: 'property-1', role: 'OWNER' as const, userId: 'user-1' };

beforeEach(() => {
  resetDbRedisForTests();
});

afterEach(() => {
  resetDbRedisForTests();
});

describe('checkSubscriptionGate — PLAN_CONFIG paths', () => {
  it('TRIAL: permitted action resolves', async () => {
    const { db } = fakeDb({ tier: 'TRIAL', status: 'TRIAL' });
    await expect(
      checkSubscriptionGate(actor, 'reservation.checkout', db),
    ).resolves.toBeUndefined();
  });

  it('STARTER: OTA action throws SUBSCRIPTION_GATE_BLOCKED (403)', async () => {
    const { db } = fakeDb({ tier: 'STARTER', status: 'ACTIVE' });
    await expect(
      checkSubscriptionGate(actor, 'channel.connect', db),
    ).rejects.toMatchObject({
      code: 'SUBSCRIPTION_GATE_BLOCKED',
      statusCode: 403,
    });
  });

  it('STARTER: rate.override_below_floor blocked', async () => {
    const { db } = fakeDb({ tier: 'STARTER', status: 'ACTIVE' });
    await expect(
      checkSubscriptionGate(actor, 'rate.override_below_floor', db),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('GROWTH: every STARTER action plus channel.connect permitted', async () => {
    const { db } = fakeDb({ tier: 'GROWTH', status: 'ACTIVE' });
    await expect(
      checkSubscriptionGate(actor, 'channel.connect', db),
    ).resolves.toBeUndefined();
  });
});

describe('checkSubscriptionGate — lifecycle states', () => {
  it('GRACE_PERIOD: whitelist action resolves', async () => {
    const { db } = fakeDb({ tier: 'STARTER', status: 'GRACE_PERIOD' });
    await expect(
      checkSubscriptionGate(actor, 'reservation.checkin', db),
    ).resolves.toBeUndefined();
  });

  it('GRACE_PERIOD: non-whitelist throws SUBSCRIPTION_GRACE_PERIOD (402)', async () => {
    const { db } = fakeDb({ tier: 'STARTER', status: 'GRACE_PERIOD' });
    await expect(
      checkSubscriptionGate(actor, 'reservation.create', db),
    ).rejects.toMatchObject({
      code: 'SUBSCRIPTION_GRACE_PERIOD',
      statusCode: 402,
    });
  });

  it('SUSPENDED: whitelist action resolves', async () => {
    const { db } = fakeDb({ tier: 'STARTER', status: 'SUSPENDED' });
    await expect(
      checkSubscriptionGate(actor, 'audit_log.read', db),
    ).resolves.toBeUndefined();
  });

  it('SUSPENDED: non-whitelist throws SUBSCRIPTION_SUSPENDED (402)', async () => {
    const { db } = fakeDb({ tier: 'STARTER', status: 'SUSPENDED' });
    await expect(
      checkSubscriptionGate(actor, 'reservation.checkin', db),
    ).rejects.toMatchObject({
      code: 'SUBSCRIPTION_SUSPENDED',
      statusCode: 402,
    });
  });

  it('CANCELLED: throws SUBSCRIPTION_CANCELLED (402) for any action', async () => {
    const { db } = fakeDb({ tier: 'GROWTH', status: 'CANCELLED' });
    await expect(
      checkSubscriptionGate(actor, 'audit_log.read', db),
    ).rejects.toMatchObject({
      code: 'SUBSCRIPTION_CANCELLED',
      statusCode: 402,
    });
  });

  it('missing subscription: throws NO_SUBSCRIPTION (402)', async () => {
    const { db } = fakeDb(null);
    await expect(
      checkSubscriptionGate(actor, 'audit_log.read', db),
    ).rejects.toMatchObject({ code: 'NO_SUBSCRIPTION', statusCode: 402 });
  });
});

describe('checkSubscriptionGate — caching', () => {
  it('second call within TTL does not hit the DB', async () => {
    const { db, findUnique } = fakeDb({ tier: 'GROWTH', status: 'ACTIVE' });
    await checkSubscriptionGate(actor, 'reservation.create', db);
    await checkSubscriptionGate(actor, 'reservation.create', db);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('after invalidateSubscriptionCache, the DB is re-queried', async () => {
    const { db, findUnique } = fakeDb({ tier: 'GROWTH', status: 'ACTIVE' });
    await checkSubscriptionGate(actor, 'reservation.create', db);
    await invalidateSubscriptionCache(actor.propertyId);
    await checkSubscriptionGate(actor, 'reservation.create', db);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('PLAN_CONFIG sanity', () => {
  it('every tier has at least the reservation actions', () => {
    for (const tier of ['TRIAL', 'STARTER', 'GROWTH'] as const) {
      expect(PLAN_CONFIG[tier].actions).toContain('reservation.create');
      expect(PLAN_CONFIG[tier].actions).toContain('reservation.checkout');
    }
  });

  it('STARTER excludes channel.* and rate.override_below_floor', () => {
    const starter = PLAN_CONFIG.STARTER.actions as readonly string[];
    expect(starter).not.toContain('channel.connect');
    expect(starter).not.toContain('rate.override_below_floor');
  });
});
