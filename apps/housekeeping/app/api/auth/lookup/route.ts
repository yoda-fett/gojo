import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';

const Body = z.object({ phone: z.string().regex(/^\d{10}$/) });

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const phone = body.phone.startsWith('+') ? body.phone : `+91${body.phone}`;
  
  const user = await prisma.user.findUnique({ where: { phone: `+91${body.phone}` } });
  if (!user) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'Phone not registered' }, { status: 404 });
  }
  const access = await prisma.propertyAccess.findFirst({
    where: { userId: String(user.id), role: 'HOUSEKEEPING', status: 'ACTIVE', revokedAt: null, deletedAt: null },
  });
  if (!access) {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'No housekeeping access' }, { status: 403 });
  }
  return NextResponse.json({ hasPin: Boolean(user.pinHash) });
}
