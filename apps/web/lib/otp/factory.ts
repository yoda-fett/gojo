import { env } from '../../env';
import type { OtpProvider } from '@gojo/types';

import { Msg91OtpProvider } from './msg91.provider';

export async function getOtpProvider(): Promise<OtpProvider> {
  if (env.OTP_PROVIDER === 'msg91') {
    return new Msg91OtpProvider(env.MSG91_AUTH_KEY!, env.MSG91_TEMPLATE_ID!);
  }

  if (env.OTP_PROVIDER === 'mock' || process.env['NODE_ENV'] !== 'production') {
    const { MockOtpProvider } = await import('./mock.provider');
    return new MockOtpProvider();
  }

  throw new Error('MockOtpProvider cannot be used in production');
}
