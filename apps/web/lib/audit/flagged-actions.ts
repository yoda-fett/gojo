import type { AuditAction } from '@gojo/types';

// Actions Sally and the wireframe flag as warranting Owner attention:
// security-sensitive (failed auth, ID reveals, exports), money-affecting
// reversals (refunds, voids, below-floor overrides), and channel/billing
// state changes that materially affect downstream operations.
export const FLAGGED_ACTIONS = new Set<AuditAction>([
  'RATE_OVERRIDE_BELOW_FLOOR',
  'FOLIO_LINE_VOIDED',
  'FOLIO_LINE_REFUNDED',
  'AUTH_LOGIN_FAILED',
  'GUEST_ID_REVEALED',
  'AUDIT_LOG_EXPORTED',
  'CHANNEL_DISCONNECTED',
  'CHANNEL_PAUSED_TRIAL_EXPIRY',
]);

export function isFlaggedAction(action: string): boolean {
  return FLAGGED_ACTIONS.has(action as AuditAction);
}
