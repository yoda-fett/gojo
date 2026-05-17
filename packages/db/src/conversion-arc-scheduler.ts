// Story 10.2d: Conversion-arc job scheduler.
// Reads `Property.conversionArcConfig` + `Subscription.currentPeriodStart`,
// enqueues one `TRIAL_NUDGE` BullMQ job per touchpoint with a deterministic
// `jobId` for idempotency. No business handlers — those live in 10-2e.

import {
  ConversionArcConfigSchema,
  type ConversionArcConfig,
  type TouchpointType,
} from '@gojo/types';

import type { PrismaClient } from './generated/client/index.js';
import {
  SUBSCRIPTION_QUEUE_NAME,
  enqueueSubscriptionJob,
  getSubscriptionQueue,
} from './queue.js';

export const TRIAL_NUDGE_JOB_NAME = 'TRIAL_NUDGE';

const DAY_MS = 24 * 60 * 60 * 1000;

function trialNudgeJobId(propertyId: string, type: TouchpointType, dayOffset: number): string {
  return `${propertyId}:${TRIAL_NUDGE_JOB_NAME}:${type}:${dayOffset}`;
}

export interface ScheduleResult {
  enqueued: number;
  skipped: number;
  reason?: 'not_trial' | 'queue_unavailable' | 'no_subscription';
}

/**
 * Schedule one delayed `TRIAL_NUDGE` job per configured touchpoint.
 *
 * Idempotent: BullMQ dedupes on `jobId`, so re-running this is safe — already-
 * scheduled jobs are not duplicated.
 *
 * Returns counts; never throws on a missing/non-TRIAL subscription (the worker
 * has no work to do in those cases).
 */
export async function scheduleConversionArcJobs(
  db: PrismaClient,
  propertyId: string,
  now: Date = new Date(),
): Promise<ScheduleResult> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { conversionArcConfig: true },
  });
  if (!property) {
    return { enqueued: 0, skipped: 0, reason: 'no_subscription' };
  }

  const subscription = await db.subscription.findUnique({
    where: { propertyId },
    select: { status: true, currentPeriodStart: true, trialStartedAt: true, createdAt: true },
  });
  if (!subscription) {
    return { enqueued: 0, skipped: 0, reason: 'no_subscription' };
  }
  if (subscription.status !== 'TRIAL') {
    return { enqueued: 0, skipped: 0, reason: 'not_trial' };
  }

  let config: ConversionArcConfig;
  try {
    config = ConversionArcConfigSchema.parse(property.conversionArcConfig);
  } catch {
    // Invalid or null config — nothing to schedule.
    return { enqueued: 0, skipped: 0 };
  }

  const anchor =
    subscription.currentPeriodStart ?? subscription.trialStartedAt ?? subscription.createdAt;

  let enqueued = 0;
  let skipped = 0;

  for (const tp of config.touchpoints) {
    const fireAt = anchor.getTime() + tp.dayOffset * DAY_MS;
    const delay = Math.max(0, fireAt - now.getTime());
    const result = await enqueueSubscriptionJob(
      TRIAL_NUDGE_JOB_NAME,
      { propertyId, type: tp.type, dayOffset: tp.dayOffset },
      { jobId: trialNudgeJobId(propertyId, tp.type, tp.dayOffset), delay },
    );
    if (result.ok) {
      enqueued += 1;
    } else {
      skipped += 1;
      // First skipped slot tells us the queue is unavailable; remaining
      // touchpoints would all hit the same path.
      return { enqueued, skipped: config.touchpoints.length - enqueued, reason: 'queue_unavailable' };
    }
  }

  return { enqueued, skipped };
}

/**
 * Remove every delayed `TRIAL_NUDGE` job for the given property.
 *
 * Returns the count removed. Safe to call when the queue is unavailable
 * (returns 0).
 */
export async function removeConversionArcJobs(propertyId: string): Promise<number> {
  const queue = getSubscriptionQueue();
  if (!queue) return 0;

  const jobs = await queue.getDelayed();
  let removed = 0;
  for (const job of jobs) {
    if (
      job.name === TRIAL_NUDGE_JOB_NAME &&
      job.data &&
      (job.data as { propertyId?: string }).propertyId === propertyId
    ) {
      await job.remove();
      removed += 1;
    }
  }
  return removed;
}

/**
 * Atomic remove-then-reschedule. Used when an Owner edits
 * `conversionArcConfig` mid-trial.
 */
export async function rescheduleConversionArcJobs(
  db: PrismaClient,
  propertyId: string,
  now: Date = new Date(),
): Promise<{ removed: number; scheduled: ScheduleResult }> {
  const removed = await removeConversionArcJobs(propertyId);
  const scheduled = await scheduleConversionArcJobs(db, propertyId, now);
  return { removed, scheduled };
}

export { SUBSCRIPTION_QUEUE_NAME };
