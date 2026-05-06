// @ts-nocheck
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { withAuth } from '@/lib/auth/api-handler';
import { setSessionCookies } from '@/lib/auth/cookies';
import { createRefreshToken } from '@/lib/auth/refresh-token';
import { REFRESH_TOKEN_MAX_AGE, signAccessToken } from '@/lib/auth/jwt';

const schema = z.object({
  propertyId: z.string().min(1),
});

export const POST = withAuth(async (req, actor) => {
  const body = schema.parse(await req.json());
  const access = await prisma.propertyAccess.findUnique({
    where: {
      propertyId_userId: {
        propertyId: body.propertyId,
        userId: actor.userId,
      },
    },
  });

  if (!access || access.deletedAt || access.revokedAt || access.status !== 'ACTIVE') {
    throw new AppError('PROPERTY_ACCESS_DENIED', 'No access to this property', 403);
  }

  const accessToken = await signAccessToken({
    userId: actor.userId,
    propertyId: body.propertyId,
    role: access.role as 'OWNER' | 'MANAGER' | 'FRONT_DESK' | 'HOUSEKEEPING',
    lastActiveAt: Date.now(),
  });

  const refresh = createRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: actor.userId,
      propertyId: body.propertyId,
      tokenHash: refresh.tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
    },
  });

  await setSessionCookies(accessToken, refresh.rawToken);
  return NextResponse.json({ userId: actor.userId, propertyId: body.propertyId, role: access.role });
});
