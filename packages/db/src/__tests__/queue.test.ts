import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  enqueueSubscriptionJob,
  resetSubscriptionQueueForTests,
} from '../queue.js';

const originalRedisUrl = process.env.REDIS_URL;

beforeEach(() => {
  delete process.env.REDIS_URL;
});

afterEach(async () => {
  await resetSubscriptionQueueForTests();
  if (originalRedisUrl) {
    process.env.REDIS_URL = originalRedisUrl;
  }
});

describe('enqueueSubscriptionJob — no-Redis fallback', () => {
  it('returns queue_unavailable when REDIS_URL is unset', async () => {
    const result = await enqueueSubscriptionJob(
      'TRIAL_NUDGE',
      { propertyId: 'p1' },
      { jobId: 'p1:TRIAL_NUDGE:100' },
    );
    expect(result).toEqual({ ok: false, reason: 'queue_unavailable' });
  });
});
