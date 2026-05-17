import { hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';

import { readHousekeepingActor } from '@/lib/auth';

const WEAK = new Set(['0000', '1111', '1234', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999']);

const Body = z.object({ pin: z.string().regex(/^\d{4}$/) });

export async function POST(req: Request) {
  try {
    const actor = await readHousekeepingActor(await cookies());
    if (!actor) return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sign in required' }, { status: 401 });

    const body = Body.parse(await req.json());
    if (WEAK.has(body.pin)) {
      throw new AppError('VALIDATION_ERROR', 'Choose a stronger PIN', 422);
    }

    await prisma.user.update({
      where: { id: actor.userId },
      data: { pinHash: await hash(body.pin, 10) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    throw error;
  }
}
