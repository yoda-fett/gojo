import { describe, expect, it } from 'vitest';

import {
  isValidHousekeepingTransition,
  isTransitionAllowedForRole,
} from '../housekeeping.js';

describe('housekeeping state machine', () => {
  it('allows the canonical lifecycle', () => {
    expect(isValidHousekeepingTransition('AVAILABLE', 'OCCUPIED')).toBe(true);
    expect(isValidHousekeepingTransition('OCCUPIED', 'DIRTY')).toBe(true);
    expect(isValidHousekeepingTransition('DIRTY', 'CLEAN')).toBe(true);
    expect(isValidHousekeepingTransition('CLEAN', 'AVAILABLE')).toBe(true);
  });

  it('rejects out-of-cycle transitions', () => {
    expect(isValidHousekeepingTransition('AVAILABLE', 'DIRTY')).toBe(false);
    expect(isValidHousekeepingTransition('CLEAN', 'OCCUPIED')).toBe(false);
    expect(isValidHousekeepingTransition('DIRTY', 'AVAILABLE')).toBe(false);
  });

  it('limits HOUSEKEEPING role to DIRTY → CLEAN', () => {
    expect(isTransitionAllowedForRole('DIRTY', 'CLEAN', 'HOUSEKEEPING')).toBe(true);
    expect(isTransitionAllowedForRole('CLEAN', 'AVAILABLE', 'HOUSEKEEPING')).toBe(false);
  });

  it('allows OWNER block transitions but blocks FRONT_DESK from them', () => {
    expect(isTransitionAllowedForRole('AVAILABLE', 'OUT_OF_ORDER', 'OWNER')).toBe(true);
    expect(isTransitionAllowedForRole('AVAILABLE', 'OUT_OF_ORDER', 'FRONT_DESK')).toBe(false);
  });
});
