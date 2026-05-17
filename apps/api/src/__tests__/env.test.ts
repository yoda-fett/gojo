import { afterEach, describe, expect, it, vi } from 'vitest';

const REQUIRED_SECRET = 'x'.repeat(32);

afterEach(() => {
  vi.resetModules();
});

describe('api env validation', () => {
  it('allows REDIS_URL to be unset (worker runs in no-queue mode)', async () => {
    // Story 10-2a: REDIS_URL became optional so the worker process can boot
    // locally without Redis. The queue helper returns queue_unavailable instead.
    delete process.env['REDIS_URL'];
    process.env['JWT_SECRET'] = REQUIRED_SECRET;
    process.env['OTP_PROVIDER'] = 'mock';

    await expect(import('../env.js')).resolves.toBeDefined();
  });

  it('throws when msg91 auth key is missing', async () => {
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['JWT_SECRET'] = REQUIRED_SECRET;
    process.env['OTP_PROVIDER'] = 'msg91';
    delete process.env['MSG91_AUTH_KEY'];

    await expect(import('../env.js')).rejects.toThrow(/MSG91_AUTH_KEY is required when OTP_PROVIDER=msg91/);
  });
});
