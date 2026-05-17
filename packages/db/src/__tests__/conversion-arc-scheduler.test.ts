// Story 10.2d: Scheduler unit tests.
// Real BullMQ requires Redis; instead we verify the no-Redis fallback path
// (REDIS_URL unset → scheduler skips and reports `queue_unavailable`) and
// the "no work to do" branches (no subscription, not TRIAL, invalid config).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CONVERSION_ARC_CONFIG } from '@gojo/types';

import {
  removeConversionArcJobs,
  rescheduleConversionArcJobs,
  scheduleConversionArcJobs,
} from '../conversion-arc-scheduler.js';
import { resetSubscriptionQueueForTests } from '../queue.js';

const originalRedisUrl = process.env.REDIS_URL;

beforeEach(() => {
  delete process.env.REDIS_URL;
});

afterEach(async () => {
  await resetSubscriptionQueueForTests();
  if (originalRedisUrl) process.env.REDIS_URL = originalRedisUrl;
});

function fakeDb({
  property,
  subscription,
}: {
  property: { conversionArcConfig: unknown } | null;
  subscription:
    | {
        status: string;
        currentPeriodStart: Date | null;
        trialStartedAt: Date | null;
        createdAt: Date;
      }
    | null;
}) {
  return {
    property: {
      findUnique: vi.fn(async () => property),
    },
    subscription: {
      findUnique: vi.fn(async () => subscription),
    },
  } as never;
}

const baseSub = {
  status: 'TRIAL',
  currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
  trialStartedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('scheduleConversionArcJobs', () => {
  it('returns no_subscription when property is missing', async () => {
    const db = fakeDb({ property: null, subscription: null });
    const r = await scheduleConversionArcJobs(db, 'p1');
    expect(r).toEqual({ enqueued: 0, skipped: 0, reason: 'no_subscription' });
  });

  it('returns no_subscription when subscription is missing', async () => {
    const db = fakeDb({
      property: { conversionArcConfig: DEFAULT_CONVERSION_ARC_CONFIG },
      subscription: null,
    });
    const r = await scheduleConversionArcJobs(db, 'p1');
    expect(r.reason).toBe('no_subscription');
  });

  it('returns not_trial when subscription is ACTIVE', async () => {
    const db = fakeDb({
      property: { conversionArcConfig: DEFAULT_CONVERSION_ARC_CONFIG },
      subscription: { ...baseSub, status: 'ACTIVE' },
    });
    const r = await scheduleConversionArcJobs(db, 'p1');
    expect(r.reason).toBe('not_trial');
  });

  it('returns queue_unavailable when REDIS_URL is unset', async () => {
    const db = fakeDb({
      property: { conversionArcConfig: DEFAULT_CONVERSION_ARC_CONFIG },
      subscription: baseSub,
    });
    const r = await scheduleConversionArcJobs(db, 'p1');
    expect(r.reason).toBe('queue_unavailable');
    expect(r.enqueued).toBe(0);
    expect(r.skipped).toBe(DEFAULT_CONVERSION_ARC_CONFIG.touchpoints.length);
  });

  it('silently skips when conversionArcConfig is null/invalid', async () => {
    const db = fakeDb({
      property: { conversionArcConfig: null },
      subscription: baseSub,
    });
    const r = await scheduleConversionArcJobs(db, 'p1');
    expect(r).toEqual({ enqueued: 0, skipped: 0 });
  });
});

describe('removeConversionArcJobs', () => {
  it('returns 0 when the queue is unavailable', async () => {
    const removed = await removeConversionArcJobs('p1');
    expect(removed).toBe(0);
  });
});

describe('rescheduleConversionArcJobs', () => {
  it('composes remove + schedule without throwing on queue_unavailable', async () => {
    const db = fakeDb({
      property: { conversionArcConfig: DEFAULT_CONVERSION_ARC_CONFIG },
      subscription: baseSub,
    });
    const r = await rescheduleConversionArcJobs(db, 'p1');
    expect(r.removed).toBe(0);
    expect(r.scheduled.reason).toBe('queue_unavailable');
  });
});
