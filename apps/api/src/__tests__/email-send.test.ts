import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REQUIRED_SECRET = 'x'.repeat(32);

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('sendEmail — fallback paths', () => {
  beforeEach(() => {
    process.env['JWT_SECRET'] = REQUIRED_SECRET;
    process.env['OTP_PROVIDER'] = 'mock';
    delete process.env['REDIS_URL'];
    delete process.env['RESEND_API_KEY'];
    delete process.env['RESEND_FROM_EMAIL'];
  });

  it('returns { ok: true, deferred: true } when RESEND_API_KEY is unset', async () => {
    const { sendEmail } = await import('../services/email/send.js');
    const r = await sendEmail({
      to: 'owner@example.com',
      templateSlug: 'trial-day-107',
      vars: {
        ownerName: 'Asha',
        daysRemaining: 7,
        savingsAmount: 1240,
        conversionUrl: 'https://app.gojo.in/billing/upgrade',
      },
    });
    expect(r).toEqual({ ok: true, deferred: true });
  });

  it('returns { ok: false } on a missing template', async () => {
    const { sendEmail } = await import('../services/email/send.js');
    const r = await sendEmail({
      to: 'owner@example.com',
      templateSlug: 'does-not-exist',
      vars: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Failed to load email template/);
    }
  });

  it('returns { ok: false } on a missing placeholder value', async () => {
    const { sendEmail } = await import('../services/email/send.js');
    const r = await sendEmail({
      to: 'owner@example.com',
      templateSlug: 'trial-day-107',
      // omit savingsAmount → strict renderer throws
      vars: { ownerName: 'Asha', daysRemaining: 7, conversionUrl: 'x' } as never,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/savingsAmount/);
    }
  });
});
