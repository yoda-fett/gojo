// @ts-nocheck
import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';

import { HK_SESSION_COOKIE, issueHousekeepingToken } from '@/lib/auth';

const Body = z.object({
  phone: z.string().regex(/^\d{10}$/),
  pin: z.string().regex(/^\d{4}$/),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { phone: `+91${body.phone}` } });
  if (!user?.pinHash || !(await compare(body.pin, user.pinHash))) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Invalid phone or PIN' }, { status: 401 });
  }
  const access = await prisma.propertyAccess.findFirst({
    where: { userId: user.id, role: 'HOUSEKEEPING', status: 'ACTIVE', revokedAt: null, deletedAt: null },
  });
  if (!access) return NextResponse.json({ code: 'FORBIDDEN', message: 'No housekeeping access' }, { status: 403 });

  const token = await issueHousekeepingToken({ userId: user.id, propertyId: access.propertyId, role: 'HOUSEKEEPING' });
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
