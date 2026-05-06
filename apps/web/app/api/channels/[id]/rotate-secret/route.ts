// @ts-nocheck
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { rotateSecret } from '@/lib/services/channels';

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (_request, actor) => {
    try {
      const result = await rotateSecret({ actor, channelId: id });
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  }, ['OWNER'])(req as never);
}
