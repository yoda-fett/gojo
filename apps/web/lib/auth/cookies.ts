import { cookies } from 'next/headers';

import { env } from '../../env';
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE } from './jwt';

export async function setSessionCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  const secure = env.NODE_ENV === 'production';

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: '/',
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/',
  });
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_TOKEN_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' });
  cookieStore.set(REFRESH_TOKEN_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' });
}
