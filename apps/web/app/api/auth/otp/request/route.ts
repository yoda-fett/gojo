// @ts-nocheck
import { hash } from 'bcryptjs';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { getOtpProvider } from '@/lib/otp/factory';
import { getRedisClient } from '@/lib/redis';

const otpRequestSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/),
});

export async function POST(req: Request) {
  try {
    const body = otpRequestSchema.parse(await req.json());
    const redis = getRedisClient();
    const rateLimit = await redis.set(`otp:rate:${body.phone}`, '1', 'EX', 60, 'NX');
    if (!rateLimit) {
      const existingSession = await prisma.otpSession.findFirst({
        where: {
          phone: body.phone,
          invalidatedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingSession) {
        return NextResponse.json({
          sessionId: existingSession.sessionId,
          reusedExistingSession: true,
          message: 'An active OTP already exists for this number. Enter the code to continue.',
        });
      }

      throw new AppError('OTP_RATE_LIMITED', 'Please wait 60 seconds before requesting another OTP.', 429);
    }

    const otp = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
    const otpHash = await hash(otp, 10);
    const provider = await getOtpProvider();
    const providerResult = await provider.sendOtp(body.phone);
    const sessionId = nanoid();

    await prisma.otpSession.create({
      data: {
        sessionId,
        phone: body.phone,
        otpHash,
        providerRequestId: providerResult.requestId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return NextResponse.json({ sessionId, reusedExistingSession: false });
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
