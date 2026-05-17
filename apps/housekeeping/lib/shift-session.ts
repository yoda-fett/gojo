export const HK_SHIFT_COOKIE = 'hk_shift_started';

export const shiftCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 16 * 60 * 60,
};
