// @ts-nocheck
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { liftRoomBlock } from '@/lib/services/room-blocks';

type Context = { params: Promise<{ id: string; blockId: string }> };

export async function DELETE(req: Request, context: Context) {
  const { blockId } = await context.params;
  return withAuth(async (_request, actor) => {
    try {
      const result = await liftRoomBlock({ actor, blockId });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  }, ['OWNER'])(req as never);
}
