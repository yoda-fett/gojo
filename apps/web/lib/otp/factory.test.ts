import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

function applyBaseEnv() {
  vi.stubEnv('DATABASE_URL', 'https://db.example.com');
  vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
}

describe('getOtpProvider', () => {
  it('always uses the mock provider outside production', async () => {
    applyBaseEnv();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OTP_PROVIDER', 'msg91');
    vi.stubEnv('MSG91_AUTH_KEY', 'auth-key');
    vi.stubEnv('MSG91_TEMPLATE_ID', 'template-id');

    const { getOtpProvider } = await import('./factory');
    const provider = await getOtpProvider();

    expect(provider.constructor.name).toBe('MockOtpProvider');
  });

  it('uses MSG91 in production when configured', async () => {
    applyBaseEnv();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OTP_PROVIDER', 'msg91');
    vi.stubEnv('MSG91_AUTH_KEY', 'auth-key');
    vi.stubEnv('MSG91_TEMPLATE_ID', 'template-id');

    const { getOtpProvider } = await import('./factory');
    const provider = await getOtpProvider();

    expect(provider.constructor.name).toBe('Msg91OtpProvider');
  });
});
