import { cookies } from 'next/headers';

import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from './jwt';

export async function getServerActor() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyAccessToken(token);
    return {
      userId: payload.sub,
      propertyId: payload.propertyId,
      role: payload.role,
      lastActiveAt: payload.lastActiveAt,
    };
  } catch {
    return null;
  }
}
