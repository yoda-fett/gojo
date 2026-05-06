// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getReservationFolio } from '@/lib/services/reservation-service';

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (_request, actor) => NextResponse.json(await getReservationFolio(actor, id)), ['OWNER', 'MANAGER', 'FRONT_DESK'])(req as never);
}
