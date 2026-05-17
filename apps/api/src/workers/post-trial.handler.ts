// Story 10.3 AC6 + AC7: POST_TRIAL_SUMMARY (day 135) and
// POST_TRIAL_SOCIAL_PROOF (day 150) handlers. Both send an email if the
// property is still SUSPENDED. Conversion (SUSPENDED → ACTIVE) clears
// these jobs upstream so they don't fire.

import type { Job } from 'bullmq';
import { prisma } from '@gojo/db';
import { buildUpgradeUrl } from '@gojo/types';

import { sendEmail } from '../services/email/send.js';

interface PostTrialJobData {
  propertyId: string;
}

export type PostTrialResult =
  | { ok: true; status: 'SUCCESS' | 'SKIPPED' | 'DEFERRED'; message?: string }
  | { ok: false; status: 'FAILED'; message: string };

async function loadOwnerContact(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { name: true, contactEmail: true },
  });
  return property;
}

async function loadSavingsSnapshot(propertyId: string): Promise<{
  savingsAmount: number;
  directBookingCount: number;
}> {
  // TODO 10-2-vars: real direct-booking savings calc.
  void propertyId;
  return { savingsAmount: 0, directBookingCount: 0 };
}

async function shouldFire(propertyId: string, reason: 'summary' | 'social-proof'): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { propertyId },
    select: { status: true },
  });
  if (!sub) return false;
  if (sub.status === 'ACTIVE' || sub.status === 'CANCELLED') {
    console.info(`[post-trial:${reason}] subscription is ${sub.status}; skipping`);
    return false;
  }
  return true;
}

export async function handlePostTrialSummary(job: Job): Promise<PostTrialResult> {
  const data = job.data as Partial<PostTrialJobData>;
  if (typeof data?.propertyId !== 'string') {
    throw new Error(`POST_TRIAL_SUMMARY job ${job.id ?? '?'} has malformed data`);
  }
  if (!(await shouldFire(data.propertyId, 'summary'))) {
    return { ok: true, status: 'SKIPPED', message: 'subscription no longer suspended' };
  }
  const property = await loadOwnerContact(data.propertyId);
  if (!property?.contactEmail) {
    return { ok: true, status: 'SKIPPED', message: 'no contactEmail' };
  }
  const { savingsAmount, directBookingCount } = await loadSavingsSnapshot(data.propertyId);
  const result = await sendEmail({
    to: property.contactEmail,
    templateSlug: 'post-trial-summary-day-135',
    vars: {
      ownerName: property.name,
      savingsAmount,
      directBookingCount,
      conversionUrl: buildUpgradeUrl(data.propertyId),
    },
  });
  if (!result.ok) return { ok: false, status: 'FAILED', message: result.error };
  if (result.deferred) return { ok: true, status: 'DEFERRED', message: 'RESEND_API_KEY unset' };
  return { ok: true, status: 'SUCCESS' };
}

export async function handlePostTrialSocialProof(job: Job): Promise<PostTrialResult> {
  const data = job.data as Partial<PostTrialJobData>;
  if (typeof data?.propertyId !== 'string') {
    throw new Error(`POST_TRIAL_SOCIAL_PROOF job ${job.id ?? '?'} has malformed data`);
  }
  if (!(await shouldFire(data.propertyId, 'social-proof'))) {
    return { ok: true, status: 'SKIPPED', message: 'subscription no longer suspended' };
  }
  const property = await loadOwnerContact(data.propertyId);
  if (!property?.contactEmail) {
    return { ok: true, status: 'SKIPPED', message: 'no contactEmail' };
  }
  const result = await sendEmail({
    to: property.contactEmail,
    templateSlug: 'post-trial-social-proof-day-150',
    vars: {
      ownerName: property.name,
      // TODO 10-2-vars: real aggregate stat (e.g. "₹X/month avg savings across
      // active Gojo properties"). For now a sensible placeholder figure.
      averageMonthlySavings: 18000,
      conversionUrl: buildUpgradeUrl(data.propertyId),
    },
  });
  if (!result.ok) return { ok: false, status: 'FAILED', message: result.error };
  if (result.deferred) return { ok: true, status: 'DEFERRED', message: 'RESEND_API_KEY unset' };
  return { ok: true, status: 'SUCCESS' };
}
