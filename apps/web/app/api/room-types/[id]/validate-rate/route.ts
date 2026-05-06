// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { validateRateForRoomType } from '@/lib/services/rate-service';

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    const { searchParams } = new URL(request.url);
    const rate = Number(searchParams.get('rate'));
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'rate must be a positive number' }, { status: 400 });
    }

    return NextResponse.json(await validateRateForRoomType(actor, id, rate));
  }, ['OWNER', 'MANAGER', 'FRONT_DESK'])(req as never);
}
