import { describe, expect, it } from 'vitest';

import { computeStepGates } from './_gates';

// Story 12.3 — gate thresholds from ACs 2/3/4.
describe('computeStepGates', () => {
  const empty = { roomTypes: 0, rooms: 0, housekeepingMembers: 0 };

  it('step 1 is always navigable past', () => {
    expect(computeStepGates(empty)[1]).toEqual({ canContinue: true });
  });

  it('step 2 blocks until at least one room type exists (AC2)', () => {
    expect(computeStepGates(empty)[2]?.canContinue).toBe(false);
    expect(computeStepGates(empty)[2]?.gateMessage).toMatch(/room type/i);
    expect(computeStepGates({ ...empty, roomTypes: 1 })[2]).toEqual({ canContinue: true });
  });

  it('step 3 blocks until at least one room exists (AC3)', () => {
    expect(computeStepGates(empty)[3]?.canContinue).toBe(false);
    expect(computeStepGates({ ...empty, rooms: 1 })[3]).toEqual({ canContinue: true });
  });

  it('step 5 blocks while any room type lacks a rate plan (12.4 AC1)', () => {
    expect(computeStepGates({ ...empty, roomTypesMissingRatePlans: 2 })[5]?.canContinue).toBe(false);
    expect(computeStepGates({ ...empty, roomTypesMissingRatePlans: 2 })[5]?.gateMessage).toMatch(/2 room types/i);
    expect(computeStepGates({ ...empty, roomTypesMissingRatePlans: 0 })[5]).toEqual({ canContinue: true });
  });

  it('step 6 needs both an amenity and a linen (12.4 AC2)', () => {
    expect(computeStepGates({ ...empty, amenityItems: 1, linenItems: 0 })[6]?.canContinue).toBe(false);
    expect(computeStepGates({ ...empty, amenityItems: 0, linenItems: 1 })[6]?.canContinue).toBe(false);
    expect(computeStepGates({ ...empty, amenityItems: 1, linenItems: 1 })[6]).toEqual({ canContinue: true });
  });

  it('step 7 is always navigable past (optional final step, 12.4 AC4)', () => {
    expect(computeStepGates(empty)[7]).toEqual({ canContinue: true });
  });

  it('step 4 blocks until at least one HOUSEKEEPING-role member exists (AC4)', () => {
    expect(computeStepGates(empty)[4]?.canContinue).toBe(false);
    expect(computeStepGates(empty)[4]?.gateMessage).toMatch(/HOUSEKEEPING/);
    expect(computeStepGates({ ...empty, housekeepingMembers: 1 })[4]).toEqual({ canContinue: true });
  });
});
