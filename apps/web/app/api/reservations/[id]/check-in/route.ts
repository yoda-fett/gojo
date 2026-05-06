// @ts-nocheck
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { checkInReservation } from '@/lib/services/reservation-service';

const schema = z.object({
  stateVersion: z.number().int().min(0),
  idType: z.enum(['AADHAAR', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID']),
  idNumber: z.string().min(4),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    const body = schema.parse(await request.json());
    const reservation = await checkInReservation(actor, id, body);
    return NextResponse.json({ data: { reservation } });
  }, ['OWNER', 'MANAGER', 'FRONT_DESK'])(req as never);
}
