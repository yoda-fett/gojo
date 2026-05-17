// @ts-nocheck
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { getServerActor } from '@/lib/auth/server-actor';
import { getRedisClient } from '@/lib/redis';

const OWNER_ROLES = new Set(['OWNER', 'MANAGER', 'FRONT_DESK']);
const WEAK = new Set([
  '0000', '1111', '1234', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
]);

const Body = z.object({ pin: z.string().regex(/^\d{4}$/) });

export async function POST(req: Request) {
  try {
    const actor = await getServerActor();
    if (!actor) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sign in required' }, { status: 401 });
    }
    if (!OWNER_ROLES.has(actor.role)) {
      return NextResponse.json({ code: 'FORBIDDEN', message: 'Not allowed' }, { status: 403 });
    }

    const body = Body.parse(await req.json());
    if (WEAK.has(body.pin)) {
      throw new AppError('VALIDATION_ERROR', 'Choose a stronger PIN', 422);
    }

    const user = await prisma.user.update({
      where: { id: actor.userId },
      data: { pinHash: await hash(body.pin, 10) },
      select: { phone: true },
    });

    try {
      await getRedisClient().del(`pin:fail:${user.phone}`);
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request' },
        { status: 422 },
      );
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
