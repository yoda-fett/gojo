// Story 10.1 — PLAN_CONFIG compile-time constant (ARCH20).
// Tier changes require a code change and deployment; no DB table for feature flags.

export type Tier = 'TRIAL' | 'STARTER' | 'GROWTH';

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED';

export type Action =
  | 'reservation.create'
  | 'reservation.cancel'
  | 'reservation.amend'
  | 'reservation.checkin'
  | 'reservation.checkout'
  | 'folio.post_charge'
  | 'folio.cash_payment'
  | 'invoice.generate'
  | 'invoice.credit_note'
  | 'channel.connect'
  | 'channel.disconnect'
  | 'channel.rotate_secret'
  | 'direct_booking.enable'
  | 'direct_booking.disable'
  | 'rate.override_below_floor'
  | 'rate.update'
  | 'cost_config.update'
  | 'audit_log.read'
  | 'subscription.upgrade'
  | 'subscription.downgrade'
  | 'subscription.cancel'
  | 'room.update_housekeeping_status'
  | 'room.create_block'
  | 'room.lift_block'
  | 'user.invite'
  | 'user.remove'
  | 'property.update'
  | 'guest_id.reveal';

export const PLAN_CONFIG: Record<Tier, { actions: readonly Action[] }> = {
  TRIAL: {
    actions: [
      'reservation.create', 'reservation.cancel', 'reservation.amend',
      'reservation.checkin', 'reservation.checkout',
      'folio.post_charge', 'folio.cash_payment',
      'channel.connect', 'channel.disconnect', 'channel.rotate_secret',
      'direct_booking.enable', 'direct_booking.disable',
      'rate.update', 'cost_config.update',
      'audit_log.read',
      'subscription.upgrade',
      'room.update_housekeeping_status', 'room.create_block', 'room.lift_block',
      'user.invite', 'user.remove',
      'property.update',
      'guest_id.reveal',
      'invoice.generate', 'invoice.credit_note',
    ],
  },
  STARTER: {
    actions: [
      'reservation.create', 'reservation.cancel', 'reservation.amend',
      'reservation.checkin', 'reservation.checkout',
      'folio.post_charge', 'folio.cash_payment',
      'direct_booking.enable', 'direct_booking.disable',
      'rate.update', 'cost_config.update',
      'audit_log.read',
      'subscription.upgrade', 'subscription.downgrade', 'subscription.cancel',
      'room.update_housekeeping_status', 'room.create_block', 'room.lift_block',
      'user.invite', 'user.remove',
      'property.update',
      'guest_id.reveal',
      'invoice.generate', 'invoice.credit_note',
    ],
  },
  GROWTH: {
    actions: [
      'reservation.create', 'reservation.cancel', 'reservation.amend',
      'reservation.checkin', 'reservation.checkout',
      'folio.post_charge', 'folio.cash_payment',
      'channel.connect', 'channel.disconnect', 'channel.rotate_secret',
      'direct_booking.enable', 'direct_booking.disable',
      'rate.update', 'rate.override_below_floor',
      'cost_config.update',
      'audit_log.read',
      'subscription.upgrade', 'subscription.downgrade', 'subscription.cancel',
      'room.update_housekeeping_status', 'room.create_block', 'room.lift_block',
      'user.invite', 'user.remove',
      'property.update',
      'guest_id.reveal',
      'invoice.generate', 'invoice.credit_note',
    ],
  },
};

export const GRACE_PERIOD_WHITELIST: readonly Action[] = [
  'reservation.checkin',
  'reservation.checkout',
  'folio.post_charge',
  'folio.cash_payment',
  'invoice.generate',
  'audit_log.read',
  'subscription.upgrade',
  'guest_id.reveal',
];

export const SUSPENDED_WHITELIST: readonly Action[] = [
  'audit_log.read',
  'subscription.upgrade',
];

export function findRequiredTier(action: Action): Tier {
  const order: Tier[] = ['TRIAL', 'STARTER', 'GROWTH'];
  for (const tier of order) {
    if (PLAN_CONFIG[tier].actions.includes(action)) return tier;
  }
  return 'GROWTH';
}

/**
 * Tier ordering for upgrade/downgrade comparison. Higher number = higher
 * privilege. TRIAL ranks below paid tiers because converting from TRIAL
 * always upgrades, never downgrades.
 */
export const TIER_RANK: Record<Tier, number> = {
  TRIAL: 0,
  STARTER: 1,
  GROWTH: 2,
};

/** A tier is a downgrade target of `from` iff its rank is strictly lower. */
export function isDowngrade(from: Tier, to: Tier): boolean {
  return TIER_RANK[to] < TIER_RANK[from];
}
