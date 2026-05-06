// @ts-nocheck
import { NextResponse } from 'next/server';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { setSessionCookies } from '@/lib/auth/cookies';
import { createRefreshToken, sha256 } from '@/lib/auth/refresh-token';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE, signAccessToken } from '@/lib/auth/jwt';

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') ?? '';
    const refreshMatch = cookieHeader.split('; ').find((part) => part.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
    const rawRefreshToken = refreshMatch?.split('=')[1];

    if (!rawRefreshToken) {
      throw new AppError('UNAUTHORIZED', 'Missing refresh token', 401);
    }

    const tokenHash = sha256(rawRefreshToken);
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= Date.now()) {
      if (existing?.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: existing.userId },
          data: { revokedAt: new Date() },
        });
        throw new AppError('REFRESH_TOKEN_REUSED', 'Refresh token reused', 401);
      }

      throw new AppError('UNAUTHORIZED', 'Refresh token invalid', 401);
    }

    const access = await prisma.propertyAccess.findFirst({
      where: {
        userId: existing.userId,
        propertyId: existing.propertyId,
        deletedAt: null,
        revokedAt: null,
        status: 'ACTIVE',
      },
    });

    if (!access) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this property', 403);
    }

    const accessToken = await signAccessToken({
      userId: existing.userId,
      propertyId: existing.propertyId,
      role: access.role as 'OWNER' | 'MANAGER' | 'FRONT_DESK' | 'HOUSEKEEPING',
      lastActiveAt: Date.now(),
    });

    const nextRefresh = createRefreshToken();
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          propertyId: existing.propertyId,
          tokenHash: nextRefresh.tokenHash,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
        },
      }),
    ]);

    await setSessionCookies(accessToken, nextRefresh.rawToken);
    return NextResponse.json({ ok: true, accessCookie: ACCESS_TOKEN_COOKIE });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message, ...(error.details ?? {}) }, { status: error.statusCode });
    }

    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
