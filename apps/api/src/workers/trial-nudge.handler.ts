// Story 10.2e: TRIAL_NUDGE worker handler.
// Routes by touchpoint type. Email/WhatsApp paths stub the actual send until
// 10-2b (Resend) and 10-2c (MSG91 WhatsApp) land. OTA_PAUSE/OTA_DISCONNECT
// are deferred to Story 10.3.

import type { Job } from 'bullmq';
import {
  disconnectAllChannelsForTrialExpiry,
  enqueueSubscriptionJob,
  pauseAllChannelsForTrialExpiry,
  prisma,
  transitionSubscription,
} from '@gojo/db';
import { buildUpgradeUrl, type TouchpointType } from '@gojo/types';

import { sendEmail } from '../services/email/send.js';
import { sendWhatsApp } from '../services/whatsapp/send.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SYSTEM_ACTOR = {
  userId: 'system:trial-expiry',
  role: 'SYSTEM' as const,
};

function systemActor(propertyId: string) {
  return { ...SYSTEM_ACTOR, propertyId } as never;
}

export interface TrialNudgeJobData {
  propertyId: string;
  type: TouchpointType;
  dayOffset: number;
}

export interface TrialNudgeResult {
  ok: boolean;
  deduped?: boolean;
  status: 'SUCCESS' | 'SKIPPED' | 'DEFERRED' | 'FAILED';
  message?: string;
}

function isTrialNudgeData(data: unknown): data is TrialNudgeJobData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.propertyId === 'string' &&
    typeof d.type === 'string' &&
    typeof d.dayOffset === 'number';
}

/**
 * Idempotency gate: insert a TrialNudgeRun row keyed on
 * (propertyId, type, dayOffset). If insert fails on the unique constraint,
 * this is a replay — short-circuit.
 *
 * Returns true on first run, false on replay.
 */
async function claimRun(data: TrialNudgeJobData): Promise<boolean> {
  try {
    await prisma.trialNudgeRun.create({
      data: {
        propertyId: data.propertyId,
        touchpointType: data.type,
        dayOffset: data.dayOffset,
        status: 'SUCCESS',
      },
    });
    return true;
  } catch (err) {
    // Prisma unique-constraint violation code P2002.
    if (typeof err === 'object' && err && 'code' in err && (err as { code: string }).code === 'P2002') {
      return false;
    }
    throw err;
  }
}

async function handleSavingsCard(data: TrialNudgeJobData): Promise<TrialNudgeResult> {
  await prisma.alert.create({
    data: {
      propertyId: data.propertyId,
      alertType: 'TRIAL_SAVINGS_CARD',
      severity: 'INFO',
      status: 'ACTIVE',
      message: 'Your direct-booking savings to date — convert to a paid plan to keep going.',
      entityId: data.propertyId,
      entityType: 'PROPERTY',
    },
  });
  return { ok: true, status: 'SUCCESS' };
}

async function loadEmailVars(data: TrialNudgeJobData): Promise<
  | { ok: true; to: string; vars: { ownerName: string; daysRemaining: number; savingsAmount: number; conversionUrl: string } }
  | { ok: false; reason: string }
> {
  const property = await prisma.property.findUnique({
    where: { id: data.propertyId },
    select: { name: true, contactEmail: true, bookingSlug: true },
  });
  if (!property?.contactEmail) {
    return { ok: false, reason: 'no contactEmail on property' };
  }
  const sub = await prisma.subscription.findUnique({
    where: { propertyId: data.propertyId },
    select: { trialEndsAt: true },
  });
  const now = Date.now();
  const daysRemaining = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
    : Math.max(0, 124 - data.dayOffset);

  // TODO 10-2-vars: real savings calc owed (direct-booking revenue *
  // averageOtaCommissionRate since subscription.currentPeriodStart). 0 is a
  // safe placeholder — the email still sends with a correct subject.
  const savingsAmount = 0;

  return {
    ok: true,
    to: property.contactEmail,
    vars: {
      ownerName: property.name,
      daysRemaining,
      savingsAmount,
      conversionUrl: buildUpgradeUrl(data.propertyId),
    },
  };
}

async function handleEmailNudge(data: TrialNudgeJobData): Promise<TrialNudgeResult> {
  const ctx = await loadEmailVars(data);
  if (!ctx.ok) {
    return { ok: true, status: 'SKIPPED', message: ctx.reason };
  }
  const templateSlug = `trial-day-${data.dayOffset}`;
  const result = await sendEmail({ to: ctx.to, templateSlug, vars: ctx.vars });
  if (!result.ok) {
    return { ok: false, status: 'FAILED', message: result.error };
  }
  if (result.deferred) {
    return { ok: true, status: 'DEFERRED', message: 'RESEND_API_KEY unset — logged only' };
  }
  // Persist providerMessageId for traceability.
  if (result.providerMessageId) {
    await prisma.trialNudgeRun.updateMany({
      where: {
        propertyId: data.propertyId,
        touchpointType: data.type,
        dayOffset: data.dayOffset,
      },
      data: { providerMessageId: result.providerMessageId },
    });
  }
  return { ok: true, status: 'SUCCESS' };
}

async function loadWhatsAppVars(data: TrialNudgeJobData): Promise<
  | { ok: true; to: string; vars: { ownerName: string; daysRemaining: number; savingsAmount: number; conversionUrl: string } }
  | { ok: false; reason: string }
> {
  const property = await prisma.property.findUnique({
    where: { id: data.propertyId },
    select: { name: true, contactPhone: true },
  });
  if (!property?.contactPhone) {
    return { ok: false, reason: 'no contactPhone on property' };
  }
  const sub = await prisma.subscription.findUnique({
    where: { propertyId: data.propertyId },
    select: { trialEndsAt: true },
  });
  const now = Date.now();
  const daysRemaining = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
    : Math.max(0, 124 - data.dayOffset);
  return {
    ok: true,
    to: property.contactPhone,
    vars: {
      ownerName: property.name,
      daysRemaining,
      // TODO 10-2-vars: real savings calc owed.
      savingsAmount: 0,
      conversionUrl: buildUpgradeUrl(data.propertyId),
    },
  };
}

async function handleWhatsAppNudge(data: TrialNudgeJobData): Promise<TrialNudgeResult> {
  const ctx = await loadWhatsAppVars(data);
  if (!ctx.ok) {
    return { ok: true, status: 'SKIPPED', message: ctx.reason };
  }
  const result = await sendWhatsApp({ to: ctx.to, vars: ctx.vars });
  if (!result.ok) {
    return { ok: false, status: 'FAILED', message: result.error };
  }
  if (result.deferred) {
    return { ok: true, status: 'DEFERRED', message: 'MSG91 WhatsApp not configured — logged only' };
  }
  if (result.providerMessageId) {
    await prisma.trialNudgeRun.updateMany({
      where: {
        propertyId: data.propertyId,
        touchpointType: data.type,
        dayOffset: data.dayOffset,
      },
      data: { providerMessageId: result.providerMessageId },
    });
  }
  return { ok: true, status: 'SUCCESS' };
}

async function handleOtaPause(data: TrialNudgeJobData): Promise<TrialNudgeResult> {
  const sub = await prisma.subscription.findUnique({
    where: { propertyId: data.propertyId },
    select: { status: true },
  });
  // Only pause if still TRIAL — Owner may have converted between scheduling
  // and firing; in that case the conversion hook already cleared this job
  // but we defend against races.
  if (sub?.status !== 'TRIAL') {
    return { ok: true, status: 'SKIPPED', message: `subscription is ${sub?.status ?? 'missing'}` };
  }
  const { paused } = await pauseAllChannelsForTrialExpiry(prisma, data.propertyId);
  return { ok: true, status: 'SUCCESS', message: `paused ${paused} channels` };
}

async function handleOtaDisconnect(data: TrialNudgeJobData): Promise<TrialNudgeResult> {
  const sub = await prisma.subscription.findUnique({
    where: { propertyId: data.propertyId },
    select: { status: true, gracePeriodDays: true },
  });
  if (!sub) {
    return { ok: true, status: 'SKIPPED', message: 'no subscription' };
  }
  if (sub.status !== 'TRIAL' && sub.status !== 'GRACE_PERIOD') {
    return { ok: true, status: 'SKIPPED', message: `subscription is ${sub.status}` };
  }

  const { disconnected } = await disconnectAllChannelsForTrialExpiry(prisma, data.propertyId);

  // TRIAL → GRACE_PERIOD (idempotent: ALREADY-GRACE_PERIOD paths early-returned above).
  if (sub.status === 'TRIAL') {
    await transitionSubscription(prisma, systemActor(data.propertyId), {
      propertyId: data.propertyId,
      toStatus: 'GRACE_PERIOD',
      reason: 'Trial expired without conversion',
    });
  }

  const graceDays = sub.gracePeriodDays ?? 7;
  // Schedule the grace-window expiry, post-trial summary (day 135 = +11d),
  // and social proof (day 150 = +26d) jobs.
  await Promise.all([
    enqueueSubscriptionJob(
      'GRACE_PERIOD_EXPIRY',
      { propertyId: data.propertyId },
      { jobId: `${data.propertyId}:GRACE_PERIOD_EXPIRY`, delay: graceDays * DAY_MS },
    ),
    enqueueSubscriptionJob(
      'POST_TRIAL_SUMMARY',
      { propertyId: data.propertyId },
      { jobId: `${data.propertyId}:POST_TRIAL_SUMMARY`, delay: 11 * DAY_MS },
    ),
    enqueueSubscriptionJob(
      'POST_TRIAL_SOCIAL_PROOF',
      { propertyId: data.propertyId },
      { jobId: `${data.propertyId}:POST_TRIAL_SOCIAL_PROOF`, delay: 26 * DAY_MS },
    ),
  ]);

  return { ok: true, status: 'SUCCESS', message: `disconnected ${disconnected} channels` };
}

const DISPATCH: Record<TouchpointType, (data: TrialNudgeJobData) => Promise<TrialNudgeResult>> = {
  SAVINGS_CARD_IN_APP: handleSavingsCard,
  EMAIL_NUDGE: handleEmailNudge,
  GRACE_PERIOD_WARNING_EMAIL: handleEmailNudge,
  WHATSAPP_NUDGE: handleWhatsAppNudge,
  OTA_PAUSE: handleOtaPause,
  OTA_DISCONNECT: handleOtaDisconnect,
};

export async function handleTrialNudge(job: Job): Promise<TrialNudgeResult> {
  if (!isTrialNudgeData(job.data)) {
    throw new Error(`TRIAL_NUDGE job ${job.id ?? '?'} has malformed data`);
  }
  const data = job.data;

  // Hotfix 2 Phase E: skip inactive properties (dormant / junk).
  const propertyState = await prisma.property.findUnique({
    where: { id: data.propertyId },
    select: { active: true },
  });
  if (!propertyState || propertyState.active === false) {
    return { ok: true, status: 'SKIPPED', message: 'inactive_property' };
  }

  const claimed = await claimRun(data);
  if (!claimed) {
    return { ok: true, deduped: true, status: 'SKIPPED', message: 'already ran' };
  }

  const handler = DISPATCH[data.type];
  if (!handler) {
    throw new Error(`Unknown touchpoint type: ${String(data.type)}`);
  }

  try {
    return await handler(data);
  } catch (err) {
    // Mark the row FAILED so a future re-run can be triaged.
    await prisma.trialNudgeRun
      .updateMany({
        where: {
          propertyId: data.propertyId,
          touchpointType: data.type,
          dayOffset: data.dayOffset,
        },
        data: {
          status: 'FAILED',
          errorReason: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(() => {
        /* best-effort: don't mask the original error */
      });
    throw err;
  }
}
