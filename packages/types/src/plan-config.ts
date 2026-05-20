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
  | 'reservation.checkIn'
  | 'reservation.checkOut'
  | 'reservation.noShow'
  | 'folio.postCharge'
  | 'folio.cashPayment'
  | 'invoice.generate'
  | 'invoice.creditNote'
  | 'channel.connect'
  | 'channel.disconnect'
  | 'channel.rotateSecret'
  | 'direct_booking.enable'
  | 'direct_booking.disable'
  | 'rate.overrideBelowFloor'
  | 'rate.update'
  | 'cost_config.update'
  | 'audit_log.read'
  | 'subscription.upgrade'
  | 'subscription.downgrade'
  | 'subscription.cancel'
  | 'room.updateHousekeepingStatus'
  | 'room.createBlock'
  | 'room.liftBlock'
  | 'user.invite'
  | 'user.remove'
  | 'property.update'
  | 'guest_id.reveal'
  | 'issue.report'
  | 'catalog_item.create'
  | 'catalog_item.update'
  | 'catalog_item.delete'
  | 'room_assignment.create'
  | 'room_assignment.update'
  | 'room_assignment.delete'
  | 'room_assignment.write'
  | 'reconciliation.acknowledge'
  | 'laundry.ownerTrigger'
  | 'laundry.log'
  | 'laundry.receive'
  | 'consumption.log'
  | 'inventory.recordArrival'
  | 'inventory.recordWriteOff'
  | 'inventory.approveWriteOff'
  | 'inventory.rejectWriteOff';

export const PLAN_CONFIG: Record<Tier, { actions: readonly Action[] }> = {
  TRIAL: {
    actions: [
      'reservation.create', 'reservation.cancel', 'reservation.amend',
      'reservation.checkIn', 'reservation.checkOut',
      'folio.postCharge', 'folio.cashPayment',
      'channel.connect', 'channel.disconnect', 'channel.rotateSecret',
      'direct_booking.enable', 'direct_booking.disable',
      'rate.update', 'cost_config.update',
      'audit_log.read',
      'subscription.upgrade',
      'room.updateHousekeepingStatus', 'room.createBlock', 'room.liftBlock',
      'user.invite', 'user.remove',
      'property.update',
      'guest_id.reveal',
      'invoice.generate', 'invoice.creditNote',
      'issue.report',
      'catalog_item.create', 'catalog_item.update', 'catalog_item.delete',
      'room_assignment.create', 'room_assignment.update', 'room_assignment.delete',
      'room_assignment.write',
      'reconciliation.acknowledge',
      'laundry.ownerTrigger', 'laundry.log', 'laundry.receive',
      'consumption.log',
      'inventory.recordArrival', 'inventory.recordWriteOff',
      'inventory.approveWriteOff', 'inventory.rejectWriteOff',
    ],
  },
  STARTER: {
    actions: [
      'reservation.create', 'reservation.cancel', 'reservation.amend',
      'reservation.checkIn', 'reservation.checkOut', 'reservation.noShow',
      'folio.postCharge', 'folio.cashPayment',
      'direct_booking.enable', 'direct_booking.disable',
      'rate.update', 'cost_config.update',
      'audit_log.read',
      'subscription.upgrade', 'subscription.downgrade', 'subscription.cancel',
      'room.updateHousekeepingStatus', 'room.createBlock', 'room.liftBlock',
      'user.invite', 'user.remove',
      'property.update',
      'guest_id.reveal',
      'invoice.generate', 'invoice.creditNote',
      'issue.report',
      'catalog_item.create', 'catalog_item.update', 'catalog_item.delete',
      'room_assignment.create', 'room_assignment.update', 'room_assignment.delete',
      'room_assignment.write',
      'reconciliation.acknowledge',
      'laundry.ownerTrigger', 'laundry.log', 'laundry.receive',
      'consumption.log',
      'inventory.recordArrival', 'inventory.recordWriteOff',
      'inventory.approveWriteOff', 'inventory.rejectWriteOff',
    ],
  },
  GROWTH: {
    actions: [
      'reservation.create', 'reservation.cancel', 'reservation.amend',
      'reservation.checkIn', 'reservation.checkOut', 'reservation.noShow',
      'folio.postCharge', 'folio.cashPayment',
      'channel.connect', 'channel.disconnect', 'channel.rotateSecret',
      'direct_booking.enable', 'direct_booking.disable',
      'rate.update', 'rate.overrideBelowFloor',
      'cost_config.update',
      'audit_log.read',
      'subscription.upgrade', 'subscription.downgrade', 'subscription.cancel',
      'room.updateHousekeepingStatus', 'room.createBlock', 'room.liftBlock',
      'user.invite', 'user.remove',
      'property.update',
      'guest_id.reveal',
      'invoice.generate', 'invoice.creditNote',
      'issue.report',
      'catalog_item.create', 'catalog_item.update', 'catalog_item.delete',
      'room_assignment.create', 'room_assignment.update', 'room_assignment.delete',
      'room_assignment.write',
      'reconciliation.acknowledge',
      'laundry.ownerTrigger', 'laundry.log', 'laundry.receive',
      'consumption.log',
      'inventory.recordArrival', 'inventory.recordWriteOff',
      'inventory.approveWriteOff', 'inventory.rejectWriteOff',
    ],
  },
};

export const GRACE_PERIOD_WHITELIST: readonly Action[] = [
  'reservation.checkIn',
  'reservation.checkOut',
  'folio.postCharge',
  'folio.cashPayment',
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
