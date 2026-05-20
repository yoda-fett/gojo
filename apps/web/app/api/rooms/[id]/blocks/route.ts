// @ts-nocheck
import { checkSubscriptionGate, prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { createRoomBlock } from '@/lib/services/room-blocks';

const schema = z.object({
  blockType: z.enum(['OUT_OF_ORDER', 'MAINTENANCE']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(1),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (request, actor) => {
    await checkSubscriptionGate(actor, 'room.createBlock', prisma);
    try {
      const body = schema.parse(await request.json());
      const block = await createRoomBlock({
        actor,
        roomId: id,
        blockType: body.blockType,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        reason: body.reason,
      });
      return NextResponse.json(block);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  }, ['OWNER'])(req as never);
}
