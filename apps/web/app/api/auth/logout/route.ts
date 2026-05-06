// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';

import { clearSessionCookies } from '@/lib/auth/cookies';
import { getServerActor } from '@/lib/auth/server-actor';
import { REFRESH_TOKEN_COOKIE } from '@/lib/auth/jwt';
import { sha256 } from '@/lib/auth/refresh-token';

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const refreshMatch = cookieHeader.split('; ').find((part) => part.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
  const rawRefreshToken = refreshMatch?.split('=')[1];

  if (rawRefreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawRefreshToken) },
      data: { revokedAt: new Date() },
    });
  }

  const actor = await getServerActor();
  if (actor) {
    await prisma.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'AUTH',
        entityId: actor.userId,
        action: 'AUTH_LOGOUT',
        actorId: actor.userId,
        actorRole: actor.role,
      },
    });
  }

  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
