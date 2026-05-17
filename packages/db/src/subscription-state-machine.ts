import { AppError, type Actor, type SubscriptionStatus } from '@gojo/types';

import { writeAuditLog } from './audit-log.js';
import { resumeAllPausedChannels } from './channel-trial-lifecycle.js';
import { removeConversionArcJobs } from './conversion-arc-scheduler.js';
import type { PrismaClient } from './generated/client/index.js';
import { getSubscriptionQueue } from './queue.js';
import { invalidateSubscriptionCache } from './subscription-gate.js';

export const ALLOWED_TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  TRIAL: ['ACTIVE', 'GRACE_PERIOD'],
  ACTIVE: ['GRACE_PERIOD', 'CANCELLED'],
  GRACE_PERIOD: ['ACTIVE', 'SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
};

export function isValidSubscriptionTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as SubscriptionStatus];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(to);
}

export interface TransitionSubscriptionParams {
  propertyId: string;
  toStatus: SubscriptionStatus;
  reason?: string;
}

export async function transitionSubscription(
  db: PrismaClient,
  actor: Actor,
  params: TransitionSubscriptionParams,
): Promise<void> {
  const { propertyId, toStatus, reason } = params;
  let previousStatus: string | null = null;

  await db.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { propertyId } });
    if (!sub) {
      throw new AppError('NO_SUBSCRIPTION', `Property ${propertyId} has no subscription`, 402);
    }

    if (!isValidSubscriptionTransition(sub.status, toStatus)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `Subscription transition ${sub.status} → ${toStatus} is not allowed`,
        409,
        { details: { from: sub.status, to: toStatus } },
      );
    }

    const result = await tx.subscription.updateMany({
      where: { id: sub.id, stateVersion: sub.stateVersion },
      data: {
        status: toStatus,
        stateVersion: { increment: 1 },
        ...(toStatus === 'ACTIVE' && { suspendedAt: null, pausedAt: null }),
        ...(toStatus === 'SUSPENDED' && { suspendedAt: new Date() }),
        ...(toStatus === 'CANCELLED' && {
          cancelledAt: new Date(),
          cancellationReason: reason ?? null,
        }),
      },
    });

    if (result.count !== 1) {
      throw new AppError(
        'INVALID_TRANSITION',
        'Subscription state version mismatch (concurrent update)',
        409,
        { details: { propertyId, expectedVersion: sub.stateVersion } },
      );
    }

    await writeAuditLog(tx, actor, {
      action: 'SUBSCRIPTION_STATUS_CHANGED',
      entityType: 'SUBSCRIPTION',
      entityId: sub.id,
      before: { status: sub.status, tier: sub.tier },
      after: { status: toStatus, tier: sub.tier },
      metadata: reason ? { reason } : null,
      fromState: sub.status,
      toState: toStatus,
    });
    previousStatus = sub.status;
  });

  await invalidateSubscriptionCache(propertyId);

  // Story 10.2d + 10.3: conversion arc stops on conversion. Best-effort —
  // a queue / channel update failure must not unwind the durable state
  // transition above.
  if (toStatus === 'ACTIVE') {
    try {
      await removeConversionArcJobs(propertyId);
    } catch (err) {
      console.warn(`[transitionSubscription] removeConversionArcJobs failed for ${propertyId}`, err);
    }
    try {
      await removePostTrialJobs(propertyId);
    } catch (err) {
      console.warn(`[transitionSubscription] removePostTrialJobs failed for ${propertyId}`, err);
    }
    // AC2: TRIAL → ACTIVE auto-resumes paused channels.
    // AC4: SUSPENDED → ACTIVE does NOT auto-reconnect (channels are
    // already deletedAt-stamped by AC3; Owner manually reconnects).
    if (previousStatus === 'TRIAL') {
      try {
        await resumeAllPausedChannels(db, propertyId);
      } catch (err) {
        console.warn(`[transitionSubscription] resumeAllPausedChannels failed for ${propertyId}`, err);
      }
    }
  }
}

const POST_TRIAL_JOB_IDS = (propertyId: string): string[] => [
  `${propertyId}:GRACE_PERIOD_EXPIRY`,
  `${propertyId}:POST_TRIAL_SUMMARY`,
  `${propertyId}:POST_TRIAL_SOCIAL_PROOF`,
];

async function removePostTrialJobs(propertyId: string): Promise<void> {
  const queue = getSubscriptionQueue();
  if (!queue) return;
  for (const jobId of POST_TRIAL_JOB_IDS(propertyId)) {
    const job = await queue.getJob(jobId);
    if (job) await job.remove();
  }
}
