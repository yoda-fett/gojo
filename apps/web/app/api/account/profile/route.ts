import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@gojo/db';

import { getServerActor } from '@/lib/auth/server-actor';

const Body = z.object({ name: z.string().min(1).max(120) });

export async function PATCH(req: Request) {
  const actor = await getServerActor();
  if (!actor) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sign in required' }, { status: 401 });
  }

  try {
    const body = Body.parse(await req.json());
    await prisma.user.update({ where: { id: actor.userId }, data: { name: body.name.trim() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: error.issues[0]?.message ?? 'Invalid request' },
        { status: 422 },
      );
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
