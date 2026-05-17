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

  const otp = process.env.NODE_ENV === 'production' ? String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0') : '987654';
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
