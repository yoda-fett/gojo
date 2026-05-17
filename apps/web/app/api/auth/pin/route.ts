// @ts-nocheck
import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { setSessionCookies } from '@/lib/auth/cookies';
import { createRefreshToken } from '@/lib/auth/refresh-token';
import { REFRESH_TOKEN_MAX_AGE, signAccessToken } from '@/lib/auth/jwt';
import { getRedisClient } from '@/lib/redis';

const Body = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  pin: z.string().regex(/^\d{4}$/),
});

const OWNER_ROLES = ['OWNER', 'MANAGER', 'FRONT_DESK'] as const;
const PIN_MAX_FAILURES = 5;
const PIN_LOCKOUT_SECONDS = 15 * 60;

function activePropertyOrder(role: string) {
  return role === 'OWNER' ? 0 : 1;
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const phone = body.phone.startsWith('+') ? body.phone : `+91${body.phone}`;
    const redis = getRedisClient();
    const failKey = `pin:fail:${phone}`;

    const currentFailures = Number((await redis.get(failKey)) ?? 0);
    if (currentFailures >= PIN_MAX_FAILURES) {
      throw new AppError(
        'PIN_LOCKED',
        'Too many failed PIN attempts. Try OTP or wait 15 minutes.',
        429,
      );
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user?.pinHash || !(await compare(body.pin, user.pinHash))) {
      const next = await redis.incr(failKey);
      if (next === 1) {
        await redis.expire(failKey, PIN_LOCKOUT_SECONDS);
      }
      throw new AppError('PIN_INVALID', 'Invalid phone or PIN', 401);
    }
    await redis.del(failKey);
    const userId = String(user.id);

    const propertyAccessList = await prisma.propertyAccess.findMany({
      where: {
        userId,
        role: { in: [...OWNER_ROLES] },
        deletedAt: null,
        revokedAt: null,
        status: 'ACTIVE',
      },
      orderBy: [{ role: 'asc' }],
    });

    if (propertyAccessList.length === 0) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No property access found for user', 403);
    }

    const sortedAccess = [...propertyAccessList].sort(
      (left, right) => activePropertyOrder(left.role) - activePropertyOrder(right.role),
    );
    const activeAccess = sortedAccess[0];

    const accessToken = await signAccessToken({
      userId,
      propertyId: activeAccess.propertyId,
      role: activeAccess.role,
      lastActiveAt: Date.now(),
    });

    const refresh = createRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId,
        propertyId: activeAccess.propertyId,
        tokenHash: refresh.tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
      },
    });

    await setSessionCookies(accessToken, refresh.rawToken);

    const properties = await Promise.all(
      sortedAccess.map(async (access) => {
        const property = await prisma.property.findUnique({ where: { id: access.propertyId } });
        return {
          propertyId: access.propertyId,
          propertyName: property?.name ?? access.propertyId,
          role: access.role,
        };
      }),
    );

    if (properties.length > 1) {
      return NextResponse.json({ userId, properties });
    }

    return NextResponse.json({ userId, defaultPropertyId: activeAccess.propertyId });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request' }, { status: 422 });
    }
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: process.env['NODE_ENV'] === 'development' && error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    );
  }
}
