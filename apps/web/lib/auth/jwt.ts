import { SignJWT, jwtVerify } from 'jose';

import type { JwtPayload, Role } from '@gojo/types';

import { env } from '../../env';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ACCESS_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

export async function signAccessToken(input: { userId: string; propertyId: string; role: Role; lastActiveAt: number }) {
  return new SignJWT({
    propertyId: input.propertyId,
    role: input.role,
    lastActiveAt: input.lastActiveAt,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const result = await jwtVerify<JwtPayload>(token, secret);
  return {
    sub: result.payload.sub ?? '',
    propertyId: result.payload.propertyId,
    role: result.payload.role,
    iat: result.payload.iat ?? 0,
    exp: result.payload.exp ?? 0,
    lastActiveAt: result.payload.lastActiveAt,
  } satisfies JwtPayload;
}

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const ACCESS_TOKEN_MAX_AGE = ACCESS_TOKEN_MAX_AGE_SECONDS;
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;
