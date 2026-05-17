import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { HK_SESSION_COOKIE, issueHousekeepingToken } from '@/lib/auth';

const Body = z.object({
  sessionId: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const session = await prisma.otpSession.findUnique({ where: { sessionId: body.sessionId } });
  if (!session || session.invalidatedAt) throw new AppError('OTP_INVALID', 'OTP session not found', 401);

  const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(String(session.expiresAt));
  if (expiresAt.getTime() <= Date.now()) throw new AppError('OTP_EXPIRED', 'OTP expired', 401);

  // Mock-OTP gate is env-driven so Vercel preview/PC deployments accept the
  // demo value (NODE_ENV is always 'production' on Vercel).
  const useMock = process.env.OTP_PROVIDER === 'mock' || process.env.NODE_ENV !== 'production';
  const mockOk = useMock && body.otp === '987654';
  const otpHash = typeof session.otpHash === 'string' ? session.otpHash : null;
  const hashOk = otpHash ? await compare(body.otp, otpHash) : false;
  if (!mockOk && !hashOk) throw new AppError('OTP_INVALID', 'Invalid OTP', 401);

  const phone = String(session.phone);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

  const userId = String(user.id);
  const access = await prisma.propertyAccess.findFirst({
    where: { userId, role: 'HOUSEKEEPING', status: 'ACTIVE', revokedAt: null, deletedAt: null },
  });
  if (!access) throw new AppError('FORBIDDEN', 'No housekeeping access', 403);

  const token = await issueHousekeepingToken({
    userId,
    propertyId: String(access.propertyId),
    role: 'HOUSEKEEPING',
  });

  await prisma.otpSession.update({
    where: { sessionId: body.sessionId },
    data: { invalidatedAt: new Date() },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(HK_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 16 * 60 * 60,
  });
  return res;
}
