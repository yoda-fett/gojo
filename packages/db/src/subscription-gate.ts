import {
  AppError,
  GRACE_PERIOD_WHITELIST,
  PLAN_CONFIG,
  SUSPENDED_WHITELIST,
  findRequiredTier,
  type Action,
  type Actor,
  type SubscriptionStatus,
  type Tier,
} from '@gojo/types';

import type { DbClient } from './types.js';
import { getDbRedis } from './redis.js';

const CACHE_KEY_PREFIX = 'plan_config:';
const CACHE_TTL_READ_SECONDS = 300;

interface CachedSubscription {
  tier: Tier;
  status: SubscriptionStatus;
}

function cacheKey(propertyId: string): string {
  return `${CACHE_KEY_PREFIX}${propertyId}`;
}

async function loadSubscription(
  propertyId: string,
  db: DbClient,
): Promise<CachedSubscription> {
  const redis = getDbRedis();
  const key = cacheKey(propertyId);

  const cached = await redis.get(key);
  if (cached) {
    try {
      return JSON.parse(cached) as CachedSubscription;
    } catch {
      // Corrupt cache entry — fall through to DB load.
    }
  }

  const sub = await db.subscription.findUnique({ where: { propertyId } });
  if (!sub) {
    throw new AppError('NO_SUBSCRIPTION', `Property ${propertyId} has no subscription`, 402);
  }

  const result: CachedSubscription = {
    tier: (sub.tier as Tier) ?? 'TRIAL',
    status: sub.status as SubscriptionStatus,
  };

  await redis.set(key, JSON.stringify(result), CACHE_TTL_READ_SECONDS);
  return result;
}

/**
 * Story 10.1: enforces subscription tier + lifecycle gating at the service boundary.
 *
 * MUST be the first call in every mutating service function (ARCH10).
 */
export async function checkSubscriptionGate(
  actor: Actor,
  action: Action | string,
  db: DbClient,
): Promise<void> {
  const sub = await loadSubscription(actor.propertyId, db);

  if (sub.status === 'CANCELLED') {
    throw new AppError(
      'SUBSCRIPTION_CANCELLED',
      `Subscription is cancelled for property ${actor.propertyId}`,
      402,
    );
  }

  if (sub.status === 'SUSPENDED') {
    if ((SUSPENDED_WHITELIST as readonly string[]).includes(action)) return;
    throw new AppError(
      'SUBSCRIPTION_SUSPENDED',
      `Action '${action}' blocked: subscription suspended`,
      402,
      { details: { action } },
    );
  }

  if (sub.status === 'GRACE_PERIOD') {
    if ((GRACE_PERIOD_WHITELIST as readonly string[]).includes(action)) return;
    throw new AppError(
      'SUBSCRIPTION_GRACE_PERIOD',
      `Action '${action}' blocked: subscription in grace period`,
      402,
      { details: { action } },
    );
  }

  // TRIAL or ACTIVE — consult PLAN_CONFIG.
  const tierConfig = PLAN_CONFIG[sub.tier];
  if (!tierConfig) {
    throw new AppError(
      'SUBSCRIPTION_GATE_BLOCKED',
      `Unknown subscription tier '${sub.tier}'`,
      403,
      { details: { tier: sub.tier, action } },
    );
  }
  if (!(tierConfig.actions as readonly string[]).includes(action)) {
    throw new AppError(
      'SUBSCRIPTION_GATE_BLOCKED',
      `Action '${action}' not available in '${sub.tier}' tier`,
      403,
      { details: { action, requiredTier: findRequiredTier(action as Action) } },
    );
  }
}

/**
 * Invalidate the cached subscription for a property. Call after any
 * subscription mutation (transition, tier change).
 */
export async function invalidateSubscriptionCache(propertyId: string): Promise<void> {
  const redis = getDbRedis();
  await redis.del(cacheKey(propertyId));
}
