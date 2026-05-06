import { AppError, type OtpProvider } from '@gojo/types';

export class Msg91OtpProvider implements OtpProvider {
  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
  ) {}

  async sendOtp(phone: string) {
    const response = await fetch('https://api.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        authkey: this.authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: phone,
        otp_expiry: 5,
        otp_length: 6,
        template_id: this.templateId,
      }),
    });

    const data = (await response.json()) as { message?: string; request_id?: string; type?: string };
    if (!response.ok || data.type === 'error' || !data.request_id) {
      throw new AppError(
        'OTP_PROVIDER_ERROR',
        'MSG91 OTP service returned an error\nYour request has been logged. Gojo will retry on next attempt.\nPlease try again in 60 seconds.',
        502,
      );
    }

    return { requestId: data.request_id };
  }

  async verifyOtp(requestId: string, otp: string) {
    const url = new URL('https://api.msg91.com/api/v5/otp/verify');
    url.searchParams.set('request_id', requestId);
    url.searchParams.set('otp', otp);
    url.searchParams.set('authkey', this.authKey);

    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new AppError(
        'OTP_PROVIDER_ERROR',
        'MSG91 OTP service returned an error\nYour request has been logged. Gojo will retry on next attempt.\nPlease try again in 60 seconds.',
        502,
      );
    }

    const data = (await response.json()) as { type?: string };
    return data.type === 'success';
  }
}
