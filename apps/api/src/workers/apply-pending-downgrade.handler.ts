// Story 10.4: APPLY_PENDING_DOWNGRADE handler. Fires at currentPeriodEnd
// for properties with a scheduled downgrade. Idempotent — verifies the
// pending tier still matches before applying, so a stale replay from a
// cancelled-then-rescheduled flow can't accidentally apply the wrong tier.

import type { Job } from 'bullmq';
import { invalidateSubscriptionCache, prisma, writeAuditLog } from '@gojo/db';
import { AppError, type Tier } from '@gojo/types';

interface ApplyDowngradeData {
  propertyId: string;
  targetTier: Tier;
}

const SYSTEM_ACTOR = {
  userId: 'system:downgrade-apply',
  role: 'SYSTEM' as const,
};

export async function handleApplyPendingDowngrade(
  job: Job,
): Promise<{ ok: boolean; status: 'SUCCESS' | 'SKIPPED'; message?: string }> {
  const raw = job.data as Partial<ApplyDowngradeData>;
  if (typeof raw?.propertyId !== 'string' || typeof raw?.targetTier !== 'string') {
    throw new AppError(
      'VALIDATION_ERROR',
      `APPLY_PENDING_DOWNGRADE job ${job.id ?? '?'} has malformed data`,
      422,
    );
  }
  const propertyId: string = raw.propertyId;
  const targetTier: Tier = raw.targetTier as Tier;

  let applied = false;

  await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { propertyId } });
    if (!sub) return;
    // Idempotency: the pending tier must still equal the job's target.
    if (sub.pendingDowngradeTier !== targetTier) return;

    const result = await tx.subscription.updateMany({
      where: { id: sub.id, stateVersion: sub.stateVersion },
      data: {
        tier: targetTier,
        pendingDowngradeTier: null,
        pendingDowngradeAt: null,
        stateVersion: { increment: 1 },
      },
    });
    if (result.count !== 1) return;

    await writeAuditLog(
      tx,
      { ...SYSTEM_ACTOR, propertyId } as never,
      {
        action: 'SUBSCRIPTION_DOWNGRADE_APPLIED',
        entityType: 'SUBSCRIPTION',
        entityId: sub.id,
        before: { tier: sub.tier },
        after: { tier: targetTier },
      },
    );
    applied = true;
  });

  if (applied) {
    await invalidateSubscriptionCache(propertyId);
    return { ok: true, status: 'SUCCESS' };
  }
  return { ok: true, status: 'SKIPPED', message: 'pending downgrade no longer matches' };
}
