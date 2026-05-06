export interface OtpProvider {
  sendOtp(phone: string): Promise<{ requestId: string }>;
  verifyOtp(requestId: string, otp: string): Promise<boolean>;
}
