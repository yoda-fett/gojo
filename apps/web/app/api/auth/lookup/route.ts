import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';

const Body = z.object({ phone: z.string().regex(/^\+?[0-9]{10,15}$/) });

const OWNER_ROLES = ['OWNER', 'MANAGER', 'FRONT_DESK'] as const;

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const phone = body.phone.startsWith('+') ? body.phone : `+91${body.phone}`;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json({ hasPin: false, registered: false });
  }

  const access = await prisma.propertyAccess.findFirst({
    where: {
      userId: String(user.id),
      role: { in: [...OWNER_ROLES] },
      status: 'ACTIVE',
      revokedAt: null,
      deletedAt: null,
    },
  });

  if (!access) {
    return NextResponse.json({ hasPin: false, registered: false });
  }

  return NextResponse.json({ hasPin: Boolean(user.pinHash), registered: true });
}
