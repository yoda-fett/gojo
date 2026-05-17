import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// env-core validates on import; satisfy the required keys before loading
// any module that pulls in src/env.ts (e.g. sendEmail).
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.OTP_PROVIDER = 'mock';

const trialNudgeRunCreate = vi.fn();
const trialNudgeRunUpdateMany = vi.fn();
const alertCreate = vi.fn();
const propertyFindUnique = vi.fn();
const subscriptionFindUnique = vi.fn();

const pauseAllChannels = vi.fn();
const disconnectAllChannels = vi.fn();
const transitionSubscriptionFn = vi.fn();
const enqueueSubscriptionJob = vi.fn();

vi.mock('@gojo/db', () => ({
  prisma: {
    trialNudgeRun: {
      create: (args: unknown) => trialNudgeRunCreate(args),
      updateMany: (args: unknown) => trialNudgeRunUpdateMany(args),
    },
    alert: {
      create: (args: unknown) => alertCreate(args),
    },
    property: {
      findUnique: (args: unknown) => propertyFindUnique(args),
    },
    subscription: {
      findUnique: (args: unknown) => subscriptionFindUnique(args),
    },
  },
  pauseAllChannelsForTrialExpiry: (...args: unknown[]) => pauseAllChannels(...args),
  disconnectAllChannelsForTrialExpiry: (...args: unknown[]) => disconnectAllChannels(...args),
  transitionSubscription: (...args: unknown[]) => transitionSubscriptionFn(...args),
  enqueueSubscriptionJob: (...args: unknown[]) => enqueueSubscriptionJob(...args),
}));

const { handleTrialNudge } = await import('../workers/trial-nudge.handler.js');

function makeJob(data: unknown) {
  return { id: 'test-job', name: 'TRIAL_NUDGE', data } as never;
}

beforeEach(() => {
  trialNudgeRunCreate.mockReset();
  trialNudgeRunUpdateMany.mockReset();
  trialNudgeRunUpdateMany.mockResolvedValue({ count: 1 });
  alertCreate.mockReset();
  pauseAllChannels.mockReset();
  pauseAllChannels.mockResolvedValue({ paused: 0 });
  disconnectAllChannels.mockReset();
  disconnectAllChannels.mockResolvedValue({ disconnected: 0 });
  transitionSubscriptionFn.mockReset();
  enqueueSubscriptionJob.mockReset();
  enqueueSubscriptionJob.mockResolvedValue({ ok: true, jobId: 'test' });
  propertyFindUnique.mockReset();
  propertyFindUnique.mockResolvedValue({
    name: 'Test Inn',
    contactEmail: 'owner@example.com',
    bookingSlug: 'test-inn',
  });
  subscriptionFindUnique.mockReset();
  subscriptionFindUnique.mockResolvedValue({
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleTrialNudge', () => {
  it('SAVINGS_CARD_IN_APP writes an ACTIVE Alert', async () => {
    trialNudgeRunCreate.mockResolvedValue({});
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'SAVINGS_CARD_IN_APP', dayOffset: 100 }),
    );
    expect(r).toEqual({ ok: true, status: 'SUCCESS' });
    expect(alertCreate).toHaveBeenCalledTimes(1);
    expect(alertCreate.mock.calls[0]![0]).toMatchObject({
      data: { alertType: 'TRIAL_SAVINGS_CARD', status: 'ACTIVE', propertyId: 'p1' },
    });
  });

  it('EMAIL_NUDGE returns DEFERRED when RESEND_API_KEY is unset (fallback path)', async () => {
    trialNudgeRunCreate.mockResolvedValue({});
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'EMAIL_NUDGE', dayOffset: 107 }),
    );
    expect(r.status).toBe('DEFERRED');
    expect(r.message).toMatch(/RESEND_API_KEY unset/);
    expect(alertCreate).not.toHaveBeenCalled();
  });

  it('GRACE_PERIOD_WARNING_EMAIL routes through the email handler', async () => {
    trialNudgeRunCreate.mockResolvedValue({});
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'GRACE_PERIOD_WARNING_EMAIL', dayOffset: 117 }),
    );
    expect(r.status).toBe('DEFERRED');
  });

  it('EMAIL_NUDGE skips when the property has no contactEmail', async () => {
    propertyFindUnique.mockResolvedValueOnce({
      name: 'Test Inn',
      contactEmail: null,
      bookingSlug: 'test-inn',
    });
    trialNudgeRunCreate.mockResolvedValue({});
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'EMAIL_NUDGE', dayOffset: 107 }),
    );
    expect(r).toMatchObject({ ok: true, status: 'SKIPPED' });
    expect(r.message).toMatch(/contactEmail/);
  });

  it('WHATSAPP_NUDGE returns DEFERRED when MSG91 is not configured', async () => {
    propertyFindUnique.mockResolvedValueOnce({
      name: 'Test Inn',
      contactEmail: 'owner@example.com',
      contactPhone: '+919810000001',
      bookingSlug: 'test-inn',
    });
    trialNudgeRunCreate.mockResolvedValue({});
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'WHATSAPP_NUDGE', dayOffset: 112 }),
    );
    expect(r.status).toBe('DEFERRED');
    expect(r.message).toMatch(/MSG91 WhatsApp not configured/);
  });

  it('WHATSAPP_NUDGE skips when contactPhone is missing', async () => {
    propertyFindUnique.mockResolvedValueOnce({
      name: 'Test Inn',
      contactEmail: 'owner@example.com',
      contactPhone: null,
      bookingSlug: 'test-inn',
    });
    trialNudgeRunCreate.mockResolvedValue({});
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'WHATSAPP_NUDGE', dayOffset: 112 }),
    );
    expect(r).toMatchObject({ ok: true, status: 'SKIPPED' });
    expect(r.message).toMatch(/contactPhone/);
  });

  it('OTA_PAUSE invokes pauseAllChannelsForTrialExpiry when subscription is TRIAL', async () => {
    trialNudgeRunCreate.mockResolvedValue({});
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'TRIAL', gracePeriodDays: 7 });
    pauseAllChannels.mockResolvedValueOnce({ paused: 3 });
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'OTA_PAUSE', dayOffset: 120 }),
    );
    expect(r.status).toBe('SUCCESS');
    expect(r.message).toMatch(/paused 3 channels/);
    expect(pauseAllChannels).toHaveBeenCalledTimes(1);
  });

  it('OTA_PAUSE skips if subscription is no longer TRIAL (race after conversion)', async () => {
    trialNudgeRunCreate.mockResolvedValue({});
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'ACTIVE', gracePeriodDays: 7 });
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'OTA_PAUSE', dayOffset: 120 }),
    );
    expect(r.status).toBe('SKIPPED');
    expect(pauseAllChannels).not.toHaveBeenCalled();
  });

  it('OTA_DISCONNECT disconnects, transitions to GRACE_PERIOD, and schedules 3 follow-ups', async () => {
    trialNudgeRunCreate.mockResolvedValue({});
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'TRIAL', gracePeriodDays: 7 });
    disconnectAllChannels.mockResolvedValueOnce({ disconnected: 2 });
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'OTA_DISCONNECT', dayOffset: 124 }),
    );
    expect(r.status).toBe('SUCCESS');
    expect(disconnectAllChannels).toHaveBeenCalledTimes(1);
    expect(transitionSubscriptionFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ toStatus: 'GRACE_PERIOD' }),
    );
    expect(enqueueSubscriptionJob).toHaveBeenCalledTimes(3);
    const jobNames = enqueueSubscriptionJob.mock.calls.map((c) => c[0]);
    expect(jobNames).toContain('GRACE_PERIOD_EXPIRY');
    expect(jobNames).toContain('POST_TRIAL_SUMMARY');
    expect(jobNames).toContain('POST_TRIAL_SOCIAL_PROOF');
  });

  it('OTA_DISCONNECT skips when already past GRACE_PERIOD', async () => {
    trialNudgeRunCreate.mockResolvedValue({});
    subscriptionFindUnique.mockResolvedValueOnce({ status: 'CANCELLED', gracePeriodDays: 7 });
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'OTA_DISCONNECT', dayOffset: 124 }),
    );
    expect(r.status).toBe('SKIPPED');
    expect(disconnectAllChannels).not.toHaveBeenCalled();
  });

  it('dedupes on unique-key conflict (P2002) — does not re-invoke side effects', async () => {
    trialNudgeRunCreate.mockRejectedValue(Object.assign(new Error('uniq'), { code: 'P2002' }));
    const r = await handleTrialNudge(
      makeJob({ propertyId: 'p1', type: 'SAVINGS_CARD_IN_APP', dayOffset: 100 }),
    );
    expect(r).toEqual({
      ok: true,
      deduped: true,
      status: 'SKIPPED',
      message: 'already ran',
    });
    expect(alertCreate).not.toHaveBeenCalled();
  });

  it('rethrows non-P2002 prisma errors from claimRun', async () => {
    trialNudgeRunCreate.mockRejectedValue(new Error('db down'));
    await expect(
      handleTrialNudge(
        makeJob({ propertyId: 'p1', type: 'SAVINGS_CARD_IN_APP', dayOffset: 100 }),
      ),
    ).rejects.toThrow(/db down/);
  });

  it('marks the run FAILED when the handler throws and rethrows', async () => {
    trialNudgeRunCreate.mockResolvedValue({});
    alertCreate.mockRejectedValue(new Error('alert table missing'));
    await expect(
      handleTrialNudge(
        makeJob({ propertyId: 'p1', type: 'SAVINGS_CARD_IN_APP', dayOffset: 100 }),
      ),
    ).rejects.toThrow(/alert table missing/);
    expect(trialNudgeRunUpdateMany).toHaveBeenCalledTimes(1);
    expect(trialNudgeRunUpdateMany.mock.calls[0]![0]).toMatchObject({
      data: { status: 'FAILED' },
    });
  });

  it('throws on malformed job data', async () => {
    await expect(handleTrialNudge(makeJob({ propertyId: 'p1' }))).rejects.toThrow(
      /malformed/,
    );
    expect(trialNudgeRunCreate).not.toHaveBeenCalled();
  });
});
