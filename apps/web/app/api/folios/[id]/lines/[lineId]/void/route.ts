// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { voidFolioLine } from '@/lib/services/reservation-service';

type Context = { params: Promise<{ id: string; lineId: string }> };

export async function POST(req: Request, context: Context) {
  const { id, lineId } = await context.params;
  return withAuth(async (_request, actor) => NextResponse.json(await voidFolioLine(actor, id, lineId)), ['OWNER', 'MANAGER'])(req as never);
}
