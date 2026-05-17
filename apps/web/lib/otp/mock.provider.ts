import { nanoid } from 'nanoid';

import type { OtpProvider } from '@gojo/types';

export class MockOtpProvider implements OtpProvider {
  sendOtp(phone: string) {
    void phone;
    return Promise.resolve({ requestId: nanoid() });
  }

  verifyOtp(requestId: string, otp: string) {
    void requestId;
    return Promise.resolve(otp === '123456');
  }
}
