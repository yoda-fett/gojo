import { jwtVerify, SignJWT } from 'jose';
import type { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';

import type { Actor } from '@gojo/types';

export const HK_SESSION_COOKIE = 'hk_session';

type CookieReader = Pick<RequestCookies, 'get'>;

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}

export async function issueHousekeepingToken(actor: Actor) {
  return new SignJWT({
    propertyId: actor.propertyId,
    role: actor.role,
    lastActiveAt: Date.now(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(actor.userId)
    .setIssuedAt()
    .setExpirationTime('16h')
    .sign(secretKey());
}

export async function readHousekeepingActor(cookies: CookieReader): Promise<Actor | null> {
  const token = cookies.get(HK_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== 'HOUSEKEEPING' || typeof payload.propertyId !== 'string' || typeof payload.sub !== 'string') {
      return null;
    }
    const actor: Actor = {
      userId: payload.sub,
      propertyId: payload.propertyId,
      role: 'HOUSEKEEPING',
    };
    if (typeof payload.lastActiveAt === 'number') actor.lastActiveAt = payload.lastActiveAt;
    return actor;
  } catch {
    return null;
  }
}
