import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getActor } from './lib/auth/get-actor';
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE, signAccessToken } from './lib/auth/jwt';

export async function middleware(request: NextRequest) {
  try {
    const actor = await getActor(request);
    const response = NextResponse.next();
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    if (refreshToken) {
      const accessToken = await signAccessToken({
        userId: actor.userId,
        propertyId: actor.propertyId,
        role: actor.role,
        lastActiveAt: Date.now(),
      });

      const secure = process.env['NODE_ENV'] === 'production';
      response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        maxAge: ACCESS_TOKEN_MAX_AGE,
        path: '/',
      });
      response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        maxAge: REFRESH_TOKEN_MAX_AGE,
        path: '/',
      });
    }

    return response;
  } catch {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
}

export const config = {
  matcher: ['/((?!api/auth|api/internal|_next/static|_next/image|favicon.ico|sign-in).*)'],
};
