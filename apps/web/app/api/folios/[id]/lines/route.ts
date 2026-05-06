// @ts-nocheck
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { addFolioLine } from '@/lib/services/reservation-service';

const schema = z.object({
  chargeType: z.enum(['PAYMENT', 'EXTRA_CHARGE', 'DISCOUNT']),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    const body = schema.parse(await request.json());
    return NextResponse.json(await addFolioLine(actor, id, body));
  }, ['OWNER', 'MANAGER', 'FRONT_DESK'])(req as never);
}
