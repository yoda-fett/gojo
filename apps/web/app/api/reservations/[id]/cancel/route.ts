// @ts-nocheck
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { cancelReservation } from '@/lib/services/reservation-service';

const schema = z.object({
  stateVersion: z.number().int().min(0),
  reason: z.string().min(1).max(500),
  cancellationFeeAmount: z.number().nonnegative().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    const body = schema.parse(await request.json());
    const reservation = await cancelReservation(actor, id, body);
    return NextResponse.json({ data: { reservation } });
  }, ['OWNER', 'MANAGER'])(req as never);
}
