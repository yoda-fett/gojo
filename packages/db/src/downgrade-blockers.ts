// Story 10.4: Compute the set of feature-usage blockers that prevent an
// Owner from scheduling a tier downgrade. Each blocker carries a
// machine-readable `feature` key, a human reason, and a suggested action
// the UI can render as a navigation link.

import { PLAN_CONFIG, type Action, type Tier } from '@gojo/types';

import type { PrismaClient } from './generated/client/index.js';

export interface DowngradeBlocker {
  feature: 'ota_channels' | 'direct_booking' | 'rate_override_below_floor';
  reason: string;
  action: string;
}

const RATE_OVERRIDE_LOOKBACK_DAYS = 30;

function targetTierAllows(targetTier: Tier, action: Action): boolean {
  return (PLAN_CONFIG[targetTier].actions as readonly string[]).includes(action);
}

export async function checkDowngradeBlockers(
  db: PrismaClient,
  propertyId: string,
  targetTier: Tier,
): Promise<DowngradeBlocker[]> {
  const blockers: DowngradeBlocker[] = [];

  // OTA channels in use but target tier doesn't include `channel.connect`.
  if (!targetTierAllows(targetTier, 'channel.connect')) {
    const activeChannels = await db.channel.count({
      where: { propertyId, deletedAt: null },
    });
    if (activeChannels > 0) {
      blockers.push({
        feature: 'ota_channels',
        reason: `${activeChannels} OTA channel${activeChannels === 1 ? ' is' : 's are'} connected. Disconnect them before downgrading.`,
        action: 'Go to Channels → Disconnect',
      });
    }
  }

  // Direct booking enabled but target tier doesn't include it.
  if (!targetTierAllows(targetTier, 'direct_booking.enable')) {
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { directBookingEnabled: true },
    });
    if (property?.directBookingEnabled) {
      blockers.push({
        feature: 'direct_booking',
        reason: 'Direct booking is enabled. Disable it before downgrading.',
        action: 'Go to Direct Booking → Disable',
      });
    }
  }

  // Below-floor rate overrides used recently — warn but allow.
  // The spec lists this as a blocker; semantically it's "acknowledge" not "fix".
  if (!targetTierAllows(targetTier, 'rate.override_below_floor')) {
    const since = new Date(Date.now() - RATE_OVERRIDE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const recentOverrides = await db.auditLog.count({
      where: {
        propertyId,
        action: 'RATE_OVERRIDE_BELOW_FLOOR',
        createdAt: { gte: since },
      },
    });
    if (recentOverrides > 0) {
      blockers.push({
        feature: 'rate_override_below_floor',
        reason: `${recentOverrides} below-floor rate override${recentOverrides === 1 ? '' : 's'} in the last ${RATE_OVERRIDE_LOOKBACK_DAYS} days. This feature won't be available after the downgrade.`,
        action: 'Acknowledge',
      });
    }
  }

  return blockers;
}
