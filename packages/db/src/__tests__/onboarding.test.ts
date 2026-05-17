import { describe, expect, it, vi } from 'vitest';

import {
  COLD_START_TOTAL_STEPS,
  completeColdStart,
  getOnboardingState,
  updateOnboardingState,
} from '../onboarding.js';

const actor = { propertyId: 'property-1', role: 'OWNER', userId: 'user-1' } as never;

function mockDb(opts: {
  findUnique?: unknown;
  findUniqueQueue?: unknown[];
}) {
  const findUnique = opts.findUniqueQueue
    ? vi.fn().mockImplementation(() => Promise.resolve(opts.findUniqueQueue!.shift()))
    : vi.fn().mockResolvedValue(opts.findUnique ?? null);
  const update = vi.fn().mockResolvedValue(undefined);
  const auditCreate = vi.fn().mockResolvedValue(undefined);
  return {
    db: {
      property: { findUnique, update },
      auditLog: { create: auditCreate },
    } as never,
    findUnique,
    update,
    auditCreate,
  };
}

describe('getOnboardingState', () => {
  it('reports not-complete with normalized empty progress', async () => {
    const { db } = mockDb({ findUnique: { coldStartCompletedAt: null, coldStartProgress: null } });
    const state = await getOnboardingState(actor, db);
    expect(state.completed).toBe(false);
    expect(state.completedAt).toBeNull();
    expect(state.progress).toEqual({ lastCompletedStep: 0 });
  });

  it('reports complete when coldStartCompletedAt is set', async () => {
    const completedAt = new Date('2026-05-15T00:00:00.000Z');
    const { db } = mockDb({ findUnique: { coldStartCompletedAt: completedAt, coldStartProgress: null } });
    const state = await getOnboardingState(actor, db);
    expect(state.completed).toBe(true);
    expect(state.completedAt).toEqual(completedAt);
  });

  it('throws NOT_FOUND when the property is missing', async () => {
    const { db } = mockDb({ findUnique: null });
    await expect(getOnboardingState(actor, db)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('updateOnboardingState', () => {
  it('advances lastCompletedStep monotonically (never backward)', async () => {
    const { db, update } = mockDb({
      findUnique: { coldStartCompletedAt: null, coldStartProgress: { lastCompletedStep: 3 } },
    });
    const state = await updateOnboardingState(actor, db, { lastCompletedStep: 1 });
    expect(state.progress.lastCompletedStep).toBe(3); // stayed at 3, not lowered to 1
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { coldStartProgress: { lastCompletedStep: 3 } } }),
    );
  });

  it('merges a draft payload under its step key', async () => {
    const { db } = mockDb({
      findUnique: { coldStartCompletedAt: null, coldStartProgress: { lastCompletedStep: 2, drafts: { a: 1 } } },
    });
    const state = await updateOnboardingState(actor, db, { draft: { step: 'cursor', data: 4 } });
    expect(state.progress.drafts).toEqual({ a: 1, cursor: 4 });
  });

  it('writes a COLD_START_SKIPPED audit entry the first time skipped flips true', async () => {
    const { db, auditCreate } = mockDb({
      findUnique: { coldStartCompletedAt: null, coldStartProgress: { lastCompletedStep: 0 } },
    });
    await updateOnboardingState(actor, db, { skipped: true });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'COLD_START_SKIPPED', entityType: 'PROPERTY' }),
    });
  });

  it('does not re-audit when skipped is already true', async () => {
    const { db, auditCreate } = mockDb({
      findUnique: { coldStartCompletedAt: null, coldStartProgress: { lastCompletedStep: 0, skipped: true } },
    });
    await updateOnboardingState(actor, db, { skipped: true });
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('throws CONFLICT when cold-start is already complete', async () => {
    const { db } = mockDb({
      findUnique: { coldStartCompletedAt: new Date(), coldStartProgress: null },
    });
    await expect(updateOnboardingState(actor, db, { lastCompletedStep: 1 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});

describe('completeColdStart', () => {
  it('stamps completion, clears progress, and audits COLD_START_COMPLETED', async () => {
    const { db, update, auditCreate } = mockDb({
      findUnique: { coldStartCompletedAt: null },
    });
    const state = await completeColdStart(actor, db);
    expect(state.completed).toBe(true);
    expect(state.completedAt).toBeInstanceOf(Date);
    expect(update).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'COLD_START_COMPLETED', entityType: 'PROPERTY' }),
    });
  });

  it('is idempotent — a second call on an already-complete property is a no-op', async () => {
    const completedAt = new Date('2026-05-10T00:00:00.000Z');
    const { db, update, auditCreate } = mockDb({ findUnique: { coldStartCompletedAt: completedAt } });
    const state = await completeColdStart(actor, db);
    expect(state.completed).toBe(true);
    expect(state.completedAt).toEqual(completedAt);
    expect(update).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe('COLD_START_TOTAL_STEPS', () => {
  it('is the 7-step cold-start wizard', () => {
    expect(COLD_START_TOTAL_STEPS).toBe(7);
  });
});
