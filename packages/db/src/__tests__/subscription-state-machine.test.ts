import { describe, expect, it } from 'vitest';

import {
  ALLOWED_TRANSITIONS,
  isValidSubscriptionTransition,
} from '../subscription-state-machine.js';

describe('subscription state machine — ALLOWED_TRANSITIONS', () => {
  it('TRIAL → ACTIVE valid', () => {
    expect(isValidSubscriptionTransition('TRIAL', 'ACTIVE')).toBe(true);
  });

  it('TRIAL → GRACE_PERIOD valid', () => {
    expect(isValidSubscriptionTransition('TRIAL', 'GRACE_PERIOD')).toBe(true);
  });

  it('ACTIVE → GRACE_PERIOD valid', () => {
    expect(isValidSubscriptionTransition('ACTIVE', 'GRACE_PERIOD')).toBe(true);
  });

  it('GRACE_PERIOD → ACTIVE valid', () => {
    expect(isValidSubscriptionTransition('GRACE_PERIOD', 'ACTIVE')).toBe(true);
  });

  it('GRACE_PERIOD → SUSPENDED valid', () => {
    expect(isValidSubscriptionTransition('GRACE_PERIOD', 'SUSPENDED')).toBe(true);
  });

  it('SUSPENDED → ACTIVE valid', () => {
    expect(isValidSubscriptionTransition('SUSPENDED', 'ACTIVE')).toBe(true);
  });

  it('SUSPENDED → CANCELLED valid', () => {
    expect(isValidSubscriptionTransition('SUSPENDED', 'CANCELLED')).toBe(true);
  });

  it('ACTIVE → CANCELLED valid', () => {
    expect(isValidSubscriptionTransition('ACTIVE', 'CANCELLED')).toBe(true);
  });

  it('CANCELLED is terminal — nothing valid', () => {
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    expect(isValidSubscriptionTransition('CANCELLED', 'ACTIVE')).toBe(false);
  });

  it('rejects unknown sources/targets', () => {
    expect(isValidSubscriptionTransition('TRIAL', 'SUSPENDED')).toBe(false);
    expect(isValidSubscriptionTransition('ACTIVE', 'TRIAL')).toBe(false);
    expect(isValidSubscriptionTransition('UNKNOWN', 'ACTIVE')).toBe(false);
  });
});
