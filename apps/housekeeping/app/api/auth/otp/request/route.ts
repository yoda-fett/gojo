import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

const Body = z.object({ phone: z.string().regex(/^\d{10}$/) });

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const phone = `+91${body.phone}`;
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) throw new AppError('NOT_FOUND', 'Phone not registered', 404);

  const access = await prisma.propertyAccess.findFirst({
    where: { userId: String(user.id), role: 'HOUSEKEEPING', status: 'ACTIVE', revokedAt: null, deletedAt: null },
  });
  if (!access) throw new AppError('FORBIDDEN', 'No housekeeping access', 403);

  const existing = await prisma.otpSession.findFirst({
    where: { phone, invalidatedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return NextResponse.json({ sessionId: existing.sessionId, reusedExistingSession: true });
  }

  // Mock-OTP gate is env-driven so Vercel preview/PC deployments can keep
  // accepting the demo value (NODE_ENV is always 'production' on Vercel).
  // Toggle in production by setting OTP_PROVIDER=msg91 + real provider keys.
  const useMock = process.env.OTP_PROVIDER === 'mock' || process.env.NODE_ENV !== 'production';
  const otp = useMock ? '987654' : String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const sessionId = crypto.randomUUID();
  await prisma.otpSession.create({
    data: {
      sessionId,
      phone,
      otpHash: await hash(otp, 10),
      providerRequestId: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return NextResponse.json({ sessionId, reusedExistingSession: false });
}
