// @ts-nocheck
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { amendReservation, getReservationDetail } from '@/lib/services/reservation-service';

const amendSchema = z.object({
  stateVersion: z.number().int().min(0),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  roomTypeId: z.string().optional(),
  roomId: z.string().optional(),
  rate: z.number().positive().optional(),
  belowFloorOverride: z.boolean().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (_request, actor) => NextResponse.json(await getReservationDetail(actor, id)), ['OWNER', 'MANAGER', 'FRONT_DESK'])(req as never);
}

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    const body = amendSchema.parse(await request.json());
    const reservation = await amendReservation(actor, id, {
      ...body,
      checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
      checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
    });
    return NextResponse.json({ data: { reservation } });
  }, ['OWNER', 'MANAGER'])(req as never);
}
