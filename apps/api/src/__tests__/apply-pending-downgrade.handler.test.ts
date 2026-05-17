import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Satisfy env-core before module load.
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.OTP_PROVIDER = 'mock';

const subscriptionFindUnique = vi.fn();
const subscriptionUpdateMany = vi.fn();
const transactionImpl = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
  await cb({
    subscription: {
      findUnique: (args: unknown) => subscriptionFindUnique(args),
      updateMany: (args: unknown) => subscriptionUpdateMany(args),
    },
    auditLog: { create: vi.fn() },
  });
});
const invalidateMock = vi.fn();
const writeAuditLogMock = vi.fn();

vi.mock('@gojo/db', () => ({
  prisma: {
    $transaction: (cb: (tx: unknown) => Promise<void>) => transactionImpl(cb),
  },
  invalidateSubscriptionCache: (...args: unknown[]) => invalidateMock(...args),
  writeAuditLog: (...args: unknown[]) => writeAuditLogMock(...args),
}));

const { handleApplyPendingDowngrade } = await import(
  '../workers/apply-pending-downgrade.handler.js'
);

function makeJob(data: unknown) {
  return { id: 'j', name: 'APPLY_PENDING_DOWNGRADE', data } as never;
}

beforeEach(() => {
  subscriptionFindUnique.mockReset();
  subscriptionUpdateMany.mockReset();
  invalidateMock.mockReset();
  writeAuditLogMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleApplyPendingDowngrade', () => {
  it('applies the tier change when pendingDowngradeTier matches', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({
      id: 'sub-1',
      tier: 'GROWTH',
      pendingDowngradeTier: 'STARTER',
      stateVersion: 5,
    });
    subscriptionUpdateMany.mockResolvedValueOnce({ count: 1 });
    const r = await handleApplyPendingDowngrade(
      makeJob({ propertyId: 'p1', targetTier: 'STARTER' }),
    );
    expect(r.status).toBe('SUCCESS');
    expect(invalidateMock).toHaveBeenCalledWith('p1');
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
  });

  it('is idempotent when pendingDowngradeTier no longer matches', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({
      id: 'sub-1',
      tier: 'GROWTH',
      pendingDowngradeTier: null,
      stateVersion: 5,
    });
    const r = await handleApplyPendingDowngrade(
      makeJob({ propertyId: 'p1', targetTier: 'STARTER' }),
    );
    expect(r.status).toBe('SKIPPED');
    expect(invalidateMock).not.toHaveBeenCalled();
    expect(subscriptionUpdateMany).not.toHaveBeenCalled();
  });

  it('skips when subscription is missing', async () => {
    subscriptionFindUnique.mockResolvedValueOnce(null);
    const r = await handleApplyPendingDowngrade(
      makeJob({ propertyId: 'p1', targetTier: 'STARTER' }),
    );
    expect(r.status).toBe('SKIPPED');
  });

  it('skips when stateVersion drift causes updateMany.count = 0', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({
      id: 'sub-1',
      tier: 'GROWTH',
      pendingDowngradeTier: 'STARTER',
      stateVersion: 5,
    });
    subscriptionUpdateMany.mockResolvedValueOnce({ count: 0 });
    const r = await handleApplyPendingDowngrade(
      makeJob({ propertyId: 'p1', targetTier: 'STARTER' }),
    );
    expect(r.status).toBe('SKIPPED');
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('throws on malformed payload', async () => {
    await expect(handleApplyPendingDowngrade(makeJob({ propertyId: 'p1' }))).rejects.toThrow(
      /malformed/,
    );
  });
});
