// @ts-nocheck
// Story 10.4: Self-serve downgrade scheduling (POST) + cancellation (DELETE).
// Annual plans short-circuit to a contact-support response; monthly plans
// schedule a deferred tier change at currentPeriodEnd via BullMQ.

import {
  checkDowngradeBlockers,
  checkSubscriptionGate,
  enqueueSubscriptionJob,
  prisma,
  writeAuditLog,
} from '@gojo/db';
import { AppError, TIER_RANK, isDowngrade, type Tier } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

const APPLY_JOB_NAME = 'APPLY_PENDING_DOWNGRADE';

function applyJobId(propertyId: string): string {
  return `${propertyId}:${APPLY_JOB_NAME}`;
}

export const POST = withAuth(async (req, actor) => {
  await checkSubscriptionGate(actor, 'subscription.downgrade', prisma);

  const body = (await req.json().catch(() => null)) as { targetTier?: Tier } | null;
  const targetTier = body?.targetTier;
  if (!targetTier || !(targetTier in TIER_RANK)) {
    throw new AppError('VALIDATION_ERROR', 'targetTier must be STARTER or GROWTH', 422);
  }

  const sub = await prisma.subscription.findUnique({
    where: { propertyId: actor.propertyId },
  });
  if (!sub) {
    throw new AppError('NO_SUBSCRIPTION', 'Property has no subscription', 402);
  }

  if (sub.billingCadence === 'ANNUAL') {
    return NextResponse.json(
      {
        code: 'CONTACT_SUPPORT_REQUIRED',
        message: 'Annual plan downgrades are handled by our team. Contact us →',
        supportEmail: 'support@gojo.in',
      },
      { status: 400 },
    );
  }

  if (!isDowngrade(sub.tier as Tier, targetTier)) {
    throw new AppError(
      'INVALID_DOWNGRADE_TARGET',
      `Target tier ${targetTier} is not a downgrade from current tier ${sub.tier}`,
      422,
    );
  }

  const blockers = await checkDowngradeBlockers(prisma, actor.propertyId, targetTier);
  if (blockers.length > 0) {
    return NextResponse.json(
      { code: 'DOWNGRADE_BLOCKED', blockers },
      { status: 422 },
    );
  }

  const effectiveAt = sub.currentPeriodEnd ?? null;
  if (!effectiveAt) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Subscription has no currentPeriodEnd; cannot schedule downgrade',
      409,
    );
  }

  await prisma.$transaction(async (tx) => {
    const result = await tx.subscription.updateMany({
      where: { id: sub.id, stateVersion: sub.stateVersion },
      data: {
        pendingDowngradeTier: targetTier,
        pendingDowngradeAt: effectiveAt,
        stateVersion: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new AppError('CONFLICT', 'Subscription was modified concurrently', 409);
    }
    await writeAuditLog(tx, actor, {
      action: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
      entityType: 'SUBSCRIPTION',
      entityId: sub.id,
      before: { pendingDowngradeTier: null, tier: sub.tier },
      after: { pendingDowngradeTier: targetTier, pendingDowngradeAt: effectiveAt.toISOString() },
    });
  });

  const delay = Math.max(0, effectiveAt.getTime() - Date.now());
  await enqueueSubscriptionJob(
    APPLY_JOB_NAME,
    { propertyId: actor.propertyId, targetTier },
    { jobId: applyJobId(actor.propertyId), delay },
  );

  return NextResponse.json({
    ok: true,
    pendingDowngradeTier: targetTier,
    effectiveAt: effectiveAt.toISOString(),
  });
});

export const DELETE = withAuth(async (_req, actor) => {
  await checkSubscriptionGate(actor, 'subscription.downgrade', prisma);

  const sub = await prisma.subscription.findUnique({
    where: { propertyId: actor.propertyId },
  });
  if (!sub) {
    throw new AppError('NO_SUBSCRIPTION', 'Property has no subscription', 402);
  }
  if (!sub.pendingDowngradeTier) {
    throw new AppError('NO_PENDING_DOWNGRADE', 'No downgrade is scheduled', 409);
  }

  await prisma.$transaction(async (tx) => {
    const result = await tx.subscription.updateMany({
      where: { id: sub.id, stateVersion: sub.stateVersion },
      data: {
        pendingDowngradeTier: null,
        pendingDowngradeAt: null,
        stateVersion: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new AppError('CONFLICT', 'Subscription was modified concurrently', 409);
    }
    await writeAuditLog(tx, actor, {
      action: 'SUBSCRIPTION_DOWNGRADE_CANCELLED',
      entityType: 'SUBSCRIPTION',
      entityId: sub.id,
      before: { pendingDowngradeTier: sub.pendingDowngradeTier },
      after: { pendingDowngradeTier: null },
    });
  });

  // Best-effort: remove the deferred APPLY job. Idempotent.
  try {
    const { getSubscriptionQueue } = await import('@gojo/db');
    const queue = getSubscriptionQueue();
    if (queue) {
      const job = await queue.getJob(applyJobId(actor.propertyId));
      if (job) await job.remove();
    }
  } catch {
    /* queue unavailable — APPLY job will no-op on the idempotency check */
  }

  return NextResponse.json({ ok: true });
});

export const GET = withAuth(async (_req, actor) => {
  const sub = await prisma.subscription.findUnique({
    where: { propertyId: actor.propertyId },
    select: {
      tier: true,
      status: true,
      billingCadence: true,
      currentPeriodEnd: true,
      pendingDowngradeTier: true,
      pendingDowngradeAt: true,
    },
  });
  if (!sub) {
    return NextResponse.json({ subscription: null });
  }
  return NextResponse.json({
    subscription: {
      tier: sub.tier,
      status: sub.status,
      billingCadence: sub.billingCadence,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      pendingDowngradeTier: sub.pendingDowngradeTier,
      pendingDowngradeAt: sub.pendingDowngradeAt?.toISOString() ?? null,
    },
  });
});
