// Story 10.2g: Server-side fetcher for the SavingsCardNudge.
// Returns null when no active TRIAL_SAVINGS_CARD Alert exists, so the
// dashboard renders without the card outside trial-conversion windows.

import { prisma } from '@gojo/db';

export interface SavingsCardSnapshot {
  alertId: string;
  /** Trial day at which this card was issued (matches touchpoint.dayOffset). */
  dayOffset: number;
  /** Days left in the trial; drives the standard vs. urgent visual variant. */
  daysRemaining: number;
  /** Cumulative direct-booking commission saved this trial (placeholder 0 until 10-2-vars). */
  savingsAmount: number;
  /** Count of direct bookings since trial start (placeholder 0 until 10-2-vars). */
  directBookingCount: number;
}

const TRIAL_LENGTH_DAYS = 124;

export async function getActiveSavingsCard(propertyId: string): Promise<SavingsCardSnapshot | null> {
  const [alert, subscription] = await Promise.all([
    prisma.alert.findFirst({
      where: {
        propertyId,
        alertType: 'TRIAL_SAVINGS_CARD',
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    }),
    prisma.subscription.findUnique({
      where: { propertyId },
      select: { trialEndsAt: true, currentPeriodStart: true, trialStartedAt: true, createdAt: true },
    }),
  ]);

  if (!alert) return null;

  const anchor =
    subscription?.currentPeriodStart ??
    subscription?.trialStartedAt ??
    subscription?.createdAt ??
    alert.createdAt;
  const dayMs = 24 * 60 * 60 * 1000;
  const dayOffset = Math.max(
    0,
    Math.floor((alert.createdAt.getTime() - anchor.getTime()) / dayMs),
  );

  const now = Date.now();
  const daysRemaining = subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now) / dayMs))
    : Math.max(0, TRIAL_LENGTH_DAYS - dayOffset);

  return {
    alertId: alert.id,
    dayOffset,
    daysRemaining,
    // TODO 10-2-vars: real direct-booking savings calc.
    savingsAmount: 0,
    directBookingCount: 0,
  };
}

export { TRIAL_LENGTH_DAYS };
