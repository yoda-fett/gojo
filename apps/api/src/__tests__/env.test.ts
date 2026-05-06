import { afterEach, describe, expect, it, vi } from 'vitest';

const REQUIRED_SECRET = 'x'.repeat(32);

afterEach(() => {
  vi.resetModules();
});

describe('api env validation', () => {
  it('throws when REDIS_URL is missing', async () => {
    delete process.env['REDIS_URL'];
    process.env['JWT_SECRET'] = REQUIRED_SECRET;
    process.env['OTP_PROVIDER'] = 'mock';

    await expect(import('../env.js')).rejects.toThrow(/REDIS_URL/);
  });

  it('throws when msg91 auth key is missing', async () => {
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    process.env['JWT_SECRET'] = REQUIRED_SECRET;
    process.env['OTP_PROVIDER'] = 'msg91';
    delete process.env['MSG91_AUTH_KEY'];

    await expect(import('../env.js')).rejects.toThrow(/MSG91_AUTH_KEY is required when OTP_PROVIDER=msg91/);
  });
});
