// Story 10.3 AC5: GRACE_PERIOD_EXPIRY handler. Fired (default) 7 days after
// trial OTA_DISCONNECT. Transitions GRACE_PERIOD → SUSPENDED if the Owner
// hasn't converted; no-op otherwise (idempotent).

import type { Job } from 'bullmq';
import { prisma, transitionSubscription } from '@gojo/db';

interface GracePeriodExpiryData {
  propertyId: string;
}

const SYSTEM_ACTOR = {
  userId: 'system:trial-expiry',
  role: 'SYSTEM' as const,
};

export async function handleGracePeriodExpiry(job: Job): Promise<{ ok: boolean; status: string; message?: string }> {
  const data = job.data as Partial<GracePeriodExpiryData>;
  if (typeof data?.propertyId !== 'string') {
    throw new Error(`GRACE_PERIOD_EXPIRY job ${job.id ?? '?'} has malformed data`);
  }
  const sub = await prisma.subscription.findUnique({
    where: { propertyId: data.propertyId },
    select: { status: true },
  });
  if (!sub) {
    return { ok: true, status: 'SKIPPED', message: 'no subscription' };
  }
  if (sub.status !== 'GRACE_PERIOD') {
    return { ok: true, status: 'SKIPPED', message: `subscription is ${sub.status}` };
  }
  await transitionSubscription(
    prisma,
    { ...SYSTEM_ACTOR, propertyId: data.propertyId } as never,
    {
      propertyId: data.propertyId,
      toStatus: 'SUSPENDED',
      reason: 'Grace period exhausted',
    },
  );
  return { ok: true, status: 'SUCCESS' };
}
