// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getBreakEvenForRoomType } from '@/lib/services/break-even-service';

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (_request, actor) => NextResponse.json(await getBreakEvenForRoomType(actor, id)), ['OWNER'])(req as never);
}
