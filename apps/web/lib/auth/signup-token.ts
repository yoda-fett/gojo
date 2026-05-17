// Hotfix 2 Phase A: signup_token cookie carries OTP-verified identity for
// users who do not yet have a User row (NEW_USER) or no PropertyAccess
// (NO_PROPERTY). It is distinct from `access_token` — property-less users
// never get an access_token.

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import { env } from '../../env';

export const SIGNUP_TOKEN_COOKIE = 'signup_token';
export const SIGNUP_TOKEN_MAX_AGE = 30 * 60; // 30 minutes

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface SignupTokenPayload {
  phone: string;
  userId?: string;
}

export async function signSignupToken(input: SignupTokenPayload): Promise<string> {
  const builder = new SignJWT({
    phone: input.phone,
    ...(input.userId ? { userId: input.userId } : {}),
    purpose: 'signup',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SIGNUP_TOKEN_MAX_AGE}s`);
  return builder.sign(secret);
}

export async function verifySignupToken(token: string): Promise<SignupTokenPayload> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.purpose !== 'signup' || typeof payload.phone !== 'string') {
    throw new Error('invalid signup token');
  }
  const out: SignupTokenPayload = { phone: payload.phone };
  if (typeof payload.userId === 'string') out.userId = payload.userId;
  return out;
}

export async function setSignupTokenCookie(token: string) {
  const store = await cookies();
  store.set(SIGNUP_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SIGNUP_TOKEN_MAX_AGE,
    path: '/',
  });
}

export async function clearSignupTokenCookie() {
  const store = await cookies();
  store.set(SIGNUP_TOKEN_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' });
}

export async function readSignupToken(): Promise<SignupTokenPayload | null> {
  const store = await cookies();
  const token = store.get(SIGNUP_TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySignupToken(token);
  } catch {
    return null;
  }
}
