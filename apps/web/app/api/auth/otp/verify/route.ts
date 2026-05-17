// @ts-nocheck
import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { setSessionCookies } from '@/lib/auth/cookies';
import { createRefreshToken } from '@/lib/auth/refresh-token';
import { REFRESH_TOKEN_MAX_AGE, signAccessToken } from '@/lib/auth/jwt';
import { getOtpProvider } from '@/lib/otp/factory';
import { env } from '@/env';

const otpVerifySchema = z.object({
  sessionId: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/),
});

const otpSessionRecordSchema = z.object({
  phone: z.string(),
  otpHash: z.string().nullable().optional(),
  providerRequestId: z.string().nullable().optional(),
  invitationPropertyId: z.string().nullable().optional(),
  expiresAt: z.union([z.date(), z.string(), z.number()]),
  attempts: z.number().nullable().optional(),
  maxAttempts: z.number().nullable().optional(),
  invalidatedAt: z.unknown().nullable().optional(),
});

const propertyAccessSchema = z.object({
  propertyId: z.string(),
  role: z.enum(['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING']),
});

function activePropertyOrder(role: string) {
  return role === 'OWNER' ? 0 : 1;
}

export async function POST(req: Request) {
  try {
    const body = otpVerifySchema.parse(await req.json());
    const session = await prisma.otpSession.findUnique({ where: { sessionId: body.sessionId } });

    if (!session) {
      throw new AppError('OTP_INVALID', 'OTP session not found', 401);
    }

    const sessionData = otpSessionRecordSchema.parse(session);

    if (sessionData.invalidatedAt) {
      throw new AppError('OTP_MAX_ATTEMPTS', 'OTP session invalidated', 429);
    }

    if (new Date(sessionData.expiresAt).getTime() <= Date.now()) {
      throw new AppError('OTP_EXPIRED', 'OTP expired', 401);
    }

    const providerRequestId = sessionData.providerRequestId ?? null;
    const otpHash = sessionData.otpHash ?? null;
    const invitationPropertyId = sessionData.invitationPropertyId ?? null;
    const attemptsSoFar = sessionData.attempts ?? 0;
    const maxAttempts = sessionData.maxAttempts ?? 5;

    let isValid = false;

    if (env.OTP_PROVIDER === 'msg91' && providerRequestId) {
      const provider = await getOtpProvider();
      isValid = await provider.verifyOtp(providerRequestId, body.otp);
    } else if (env.OTP_PROVIDER === 'mock' && body.otp === '123456') {
      isValid = true;
    } else if (otpHash) {
      isValid = await compare(body.otp, otpHash);
    }

    if (!isValid) {
      const attempts = attemptsSoFar + 1;
      await prisma.otpSession.update({
        where: { sessionId: body.sessionId },
        data: {
          attempts,
          invalidatedAt: attempts >= maxAttempts ? new Date() : null,
        },
      });

      if (attempts >= maxAttempts) {
        throw new AppError('OTP_MAX_ATTEMPTS', 'Too many OTP attempts', 429);
      }

      throw new AppError('OTP_INVALID', 'Invalid OTP', 401);
    }

    const user = await prisma.user.upsert({
      where: { phone: sessionData.phone },
      update: {},
      create: {
        phone: sessionData.phone,
      },
    });
    const userId = String(user.id);

    if (invitationPropertyId) {
      await prisma.propertyAccess.updateMany({
        where: {
          propertyId: invitationPropertyId,
          userId,
          status: 'PENDING',
          revokedAt: null,
        },
        data: {
          status: 'ACTIVE',
        },
      });
    }

    const propertyAccessList = await prisma.propertyAccess.findMany({
      where: {
        userId,
        deletedAt: null,
        revokedAt: null,
        status: 'ACTIVE',
      },
      orderBy: [{ role: 'asc' }],
    });
    const accessList = z.array(propertyAccessSchema).parse(propertyAccessList);

    if (accessList.length === 0) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No property access found for user', 403);
    }

    const sortedAccess = [...accessList].sort((left, right) => activePropertyOrder(left.role) - activePropertyOrder(right.role));
    const activeAccess =
      sortedAccess.find((access) => access.propertyId === invitationPropertyId) ??
      sortedAccess[0];

    if (!activeAccess) {
      throw new AppError('PROPERTY_ACCESS_DENIED', 'No active property could be selected', 403);
    }

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
    await prisma.otpSession.update({
      where: { sessionId: body.sessionId },
      data: {
        invalidatedAt: new Date(),
      },
    });

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

    const hasPin = Boolean(user.pinHash);

    if (properties.length > 1) {
      return NextResponse.json({ userId, properties, hasPin });
    }

    return NextResponse.json({ userId, defaultPropertyId: activeAccess.propertyId, hasPin });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message, ...(error.details ?? {}) }, { status: error.statusCode });
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
