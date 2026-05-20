import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { loadReservationHistory } from '@/lib/audit/reservation-history';

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(
    async (_request, actor) =>
      NextResponse.json({ events: await loadReservationHistory(actor.propertyId, id) }),
    ['OWNER', 'MANAGER', 'FRONT_DESK'],
  )(req as never);
}
