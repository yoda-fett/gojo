import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// env-core validates on import; satisfy required keys before loading any
// module that pulls in src/env.ts.
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.OTP_PROVIDER = 'mock';

const propertyFindUnique = vi.fn();
const subscriptionFindUnique = vi.fn();

vi.mock('@gojo/db', () => ({
  prisma: {
    property: { findUnique: (args: unknown) => propertyFindUnique(args) },
    subscription: { findUnique: (args: unknown) => subscriptionFindUnique(args) },
  },
  transitionSubscription: vi.fn(),
}));

const {
  handleGracePeriodExpiry,
} = await import('../workers/grace-period.handler.js');

const { handlePostTrialSummary, handlePostTrialSocialProof } = await import(
  '../workers/post-trial.handler.js'
);

const dbMod = await import('@gojo/db');
const transitionSubscriptionMock = dbMod.transitionSubscription as ReturnType<typeof vi.fn>;

function makeJob(name: string, data: unknown) {
  return { id: 'j', name, data } as never;
}

beforeEach(() => {
  propertyFindUnique.mockReset();
  subscriptionFindUnique.mockReset();
  transitionSubscriptionMock.mockReset();
  propertyFindUnique.mockResolvedValue({ name: 'Test Inn', contactEmail: 'owner@example.com' });
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleGracePeriodExpiry', () => {
  it('transitions GRACE_PERIOD → SUSPENDED', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'GRACE_PERIOD' });
    const r = await handleGracePeriodExpiry(makeJob('GRACE_PERIOD_EXPIRY', { propertyId: 'p1' }));
    expect(r.status).toBe('SUCCESS');
    expect(transitionSubscriptionMock).toHaveBeenCalledTimes(1);
    expect(transitionSubscriptionMock.mock.calls[0]![2]).toMatchObject({
      toStatus: 'SUSPENDED',
    });
  });

  it('no-ops when subscription is no longer GRACE_PERIOD (idempotent)', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'ACTIVE' });
    const r = await handleGracePeriodExpiry(makeJob('GRACE_PERIOD_EXPIRY', { propertyId: 'p1' }));
    expect(r.status).toBe('SKIPPED');
    expect(transitionSubscriptionMock).not.toHaveBeenCalled();
  });

  it('throws on malformed data', async () => {
    await expect(
      handleGracePeriodExpiry(makeJob('GRACE_PERIOD_EXPIRY', {})),
    ).rejects.toThrow(/malformed/);
  });
});

describe('handlePostTrialSummary', () => {
  it('skips when subscription is ACTIVE', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'ACTIVE' });
    const r = await handlePostTrialSummary(makeJob('POST_TRIAL_SUMMARY', { propertyId: 'p1' }));
    expect(r.status).toBe('SKIPPED');
  });

  it('skips when contactEmail is missing', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'SUSPENDED' });
    propertyFindUnique.mockResolvedValueOnce({ name: 'Test Inn', contactEmail: null });
    const r = await handlePostTrialSummary(makeJob('POST_TRIAL_SUMMARY', { propertyId: 'p1' }));
    expect(r.status).toBe('SKIPPED');
    expect(r.message).toMatch(/contactEmail/);
  });

  it('DEFERRED when SUSPENDED + email valid + RESEND_API_KEY unset', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'SUSPENDED' });
    const r = await handlePostTrialSummary(makeJob('POST_TRIAL_SUMMARY', { propertyId: 'p1' }));
    expect(r.status).toBe('DEFERRED');
  });
});

describe('handlePostTrialSocialProof', () => {
  it('skips when subscription is no longer SUSPENDED', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'ACTIVE' });
    const r = await handlePostTrialSocialProof(makeJob('POST_TRIAL_SOCIAL_PROOF', { propertyId: 'p1' }));
    expect(r.status).toBe('SKIPPED');
  });

  it('DEFERRED on SUSPENDED + RESEND unset', async () => {
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'SUSPENDED' });
    const r = await handlePostTrialSocialProof(makeJob('POST_TRIAL_SOCIAL_PROOF', { propertyId: 'p1' }));
    expect(r.status).toBe('DEFERRED');
  });
});
