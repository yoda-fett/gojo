import { AppError, type Actor } from '@gojo/types';
import type { NextRequest } from 'next/server';

import { env } from '../../env';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from './jwt';

export async function getActor(req: NextRequest): Promise<Actor> {
  // Fall back to `Authorization: Bearer <token>` when the cookie is absent.
  // The housekeeping companion app proxies its task-submit calls into web's
  // API and forwards the staff's JWT this way (its httpOnly session cookie
  // can't be sent cross-origin). Same JWT_SECRET + HS256 across both apps.
  const cookieToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
  const token = cookieToken ?? bearerToken;

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Missing access token', 401);
  }

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch (error) {
    throw new AppError('UNAUTHORIZED', 'Invalid access token', 401, { cause: error });
  }

  if (payload.lastActiveAt < Date.now() - env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000) {
    throw new AppError('UNAUTHORIZED', 'Session expired', 401, { details: { code: 'SESSION_EXPIRED' } });
  }

  return {
    userId: payload.sub,
    propertyId: payload.propertyId,
    role: payload.role,
    lastActiveAt: payload.lastActiveAt,
  };
}
