// @ts-nocheck
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { updateRoomTypeRates } from '@/lib/services/rate-service';

const schema = z.object({
  floorRate: z.number().positive(),
  stateVersion: z.number().int().min(0),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    const body = schema.parse(await request.json());
    const roomType = await updateRoomTypeRates(actor, id, body);
    return NextResponse.json({ data: { roomType } });
  }, ['OWNER'])(req as never);
}
