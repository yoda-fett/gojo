// Story 10.3: System-owned channel pause / resume / disconnect for trial
// expiry. Distinct from Owner-initiated channel ops (apps/web/lib/services/channels.ts)
// because these run from the BullMQ worker without an Owner Actor — they
// audit-log against a synthetic SYSTEM_TRIAL_EXPIRY actor.

import type { Actor } from '@gojo/types';

import { writeAuditLog } from './audit-log.js';
import type { PrismaClient } from './generated/client/index.js';

const SYSTEM_ACTOR: Actor = {
  userId: 'system:trial-expiry',
  role: 'SYSTEM' as never,
  propertyId: '',
};

function actorForProperty(propertyId: string): Actor {
  return { ...SYSTEM_ACTOR, propertyId };
}

const PAUSE_REASON_TRIAL = 'TRIAL_EXPIRY_DAY_120';

export interface PauseResult {
  paused: number;
}

/**
 * Pause every active OTA channel for a property. Idempotent — channels
 * already paused are skipped.
 */
export async function pauseAllChannelsForTrialExpiry(
  db: PrismaClient,
  propertyId: string,
): Promise<PauseResult> {
  const actor = actorForProperty(propertyId);
  let paused = 0;
  await db.$transaction(async (tx) => {
    const channels = await tx.channel.findMany({
      where: { propertyId, deletedAt: null, pausedAt: null },
      select: { id: true },
    });
    if (channels.length === 0) return;
    const now = new Date();
    for (const ch of channels) {
      await tx.channel.update({
        where: { id: ch.id },
        data: { pausedAt: now, pausedReason: PAUSE_REASON_TRIAL },
      });
      await writeAuditLog(tx, actor, {
        action: 'CHANNEL_PAUSED_TRIAL_EXPIRY',
        entityType: 'CHANNEL',
        entityId: ch.id,
        before: { pausedAt: null },
        after: { pausedAt: now.toISOString(), reason: PAUSE_REASON_TRIAL },
      });
    }
    await tx.alert.create({
      data: {
        propertyId,
        alertType: 'OTA_PAUSED_TRIAL_EXPIRY',
        severity: 'HIGH',
        status: 'ACTIVE',
        message: 'OTA channels paused — trial ending in 4 days. Convert now to resume.',
        entityType: 'PROPERTY',
        entityId: propertyId,
      },
    });
    paused = channels.length;
  });
  return { paused };
}

export interface ResumeResult {
  resumed: number;
}

/**
 * Resume every paused (not yet disconnected) channel for a property.
 * Called from the subscription state-machine TRIAL→ACTIVE hook.
 */
export async function resumeAllPausedChannels(
  db: PrismaClient,
  propertyId: string,
): Promise<ResumeResult> {
  const actor = actorForProperty(propertyId);
  let resumed = 0;
  await db.$transaction(async (tx) => {
    const paused = await tx.channel.findMany({
      where: { propertyId, deletedAt: null, pausedAt: { not: null } },
      select: { id: true, pausedAt: true },
    });
    if (paused.length === 0) return;
    for (const ch of paused) {
      await tx.channel.update({
        where: { id: ch.id },
        data: { pausedAt: null, pausedReason: null },
      });
      await writeAuditLog(tx, actor, {
        action: 'CHANNEL_RESUMED_POST_CONVERSION',
        entityType: 'CHANNEL',
        entityId: ch.id,
        before: { pausedAt: ch.pausedAt?.toISOString() ?? null },
        after: { pausedAt: null },
      });
    }
    await tx.alert.updateMany({
      where: {
        propertyId,
        alertType: 'OTA_PAUSED_TRIAL_EXPIRY',
        status: 'ACTIVE',
      },
      data: { status: 'DISMISSED', resolvedAt: new Date() },
    });
    resumed = paused.length;
  });
  return { resumed };
}

export interface DisconnectResult {
  disconnected: number;
}

/**
 * Disconnect every channel for a property at trial expiry: soft-delete the
 * channel and expire any active webhook secrets. Mirrors Story 8.1's
 * Owner-initiated disconnect but flagged with the trial-expiry actor.
 */
export async function disconnectAllChannelsForTrialExpiry(
  db: PrismaClient,
  propertyId: string,
): Promise<DisconnectResult> {
  const actor = actorForProperty(propertyId);
  let disconnected = 0;
  await db.$transaction(async (tx) => {
    const channels = await tx.channel.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true },
    });
    if (channels.length === 0) return;
    const now = new Date();
    for (const ch of channels) {
      await tx.channel.update({
        where: { id: ch.id },
        data: {
          deletedAt: now,
          deletedBy: 'SYSTEM_TRIAL_EXPIRY',
        },
      });
      await tx.webhookSecret.updateMany({
        where: { channelId: ch.id, status: { in: ['ACTIVE', 'ROTATING'] } },
        data: { status: 'EXPIRED', expiredAt: now },
      });
      await writeAuditLog(tx, actor, {
        action: 'CHANNEL_DISCONNECTED_TRIAL_EXPIRY',
        entityType: 'CHANNEL',
        entityId: ch.id,
        before: { deletedAt: null },
        after: { deletedAt: now.toISOString(), deletedBy: 'SYSTEM_TRIAL_EXPIRY' },
      });
    }
    disconnected = channels.length;
  });
  return { disconnected };
}

export { PAUSE_REASON_TRIAL };
