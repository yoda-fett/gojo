// Story 12.3 + 12.4 — pure helper that turns raw counts into the shell's
// per-step gate map. Kept side-effect-free so it's unit-testable without a
// DOM/render harness (vitest is node-env here, *.test.ts only).

export type StepGate = { canContinue: boolean; gateMessage?: string };
export type StepCounts = {
  roomTypes: number;
  rooms: number;
  housekeepingMembers: number;
  // Story 12.4 additions:
  // `roomTypesMissingRatePlans` = count of room types with zero rate plans —
  // we enforce ≥1 rate plan per room type (AC1), so this must be 0.
  roomTypesMissingRatePlans?: number;
  amenityItems?: number;
  linenItems?: number;
};

export function computeStepGates(counts: StepCounts): Record<number, StepGate> {
  return {
    // Step 1 — Property profile: form save is the gate (AC6 of 12.3 — empty-state resume).
    1: { canContinue: true },
    2: {
      canContinue: counts.roomTypes >= 1,
      ...(counts.roomTypes === 0 ? { gateMessage: 'Add at least one room type before continuing.' } : {}),
    },
    3: {
      canContinue: counts.rooms >= 1,
      ...(counts.rooms === 0 ? { gateMessage: 'Add at least one room before continuing.' } : {}),
    },
    4: {
      canContinue: counts.housekeepingMembers >= 1,
      ...(counts.housekeepingMembers === 0
        ? { gateMessage: 'At least one team member with the HOUSEKEEPING role is required before continuing.' }
        : {}),
    },
    // Step 5 — Rate management: every room type needs ≥1 rate plan (12.4 AC1).
    5: {
      canContinue: (counts.roomTypesMissingRatePlans ?? 0) === 0,
      ...((counts.roomTypesMissingRatePlans ?? 0) > 0
        ? { gateMessage: `${counts.roomTypesMissingRatePlans} room type${(counts.roomTypesMissingRatePlans ?? 0) === 1 ? '' : 's'} still need at least one rate plan.` }
        : {}),
    },
    // Step 6 — Housekeeping Catalog: ≥1 amenity AND ≥1 linen (12.4 AC2).
    6: {
      canContinue: (counts.amenityItems ?? 0) >= 1 && (counts.linenItems ?? 0) >= 1,
      ...(((counts.amenityItems ?? 0) < 1 || (counts.linenItems ?? 0) < 1)
        ? { gateMessage: `Add at least one amenity (${counts.amenityItems ?? 0}) and one linen (${counts.linenItems ?? 0}) before continuing.` }
        : {}),
    },
    // Step 7 — Direct booking: optional. Shell renders a "Skip" button via
    // STEPS[6].optional; no gate enforced here.
    7: { canContinue: true },
  };
}
