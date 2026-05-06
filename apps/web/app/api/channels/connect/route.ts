// @ts-nocheck
import { checkSubscriptionGate, prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-handler';
import { connectChannel } from '@/lib/services/channels';

const schema = z.object({
  channelType: z.enum(['MMT', 'BOOKING_COM', 'AGODA', 'GOIBIBO', 'OTHER']),
});

export const POST = withAuth(async (req, actor) => {
  await checkSubscriptionGate(actor, 'CHANNEL_CONNECT', prisma);
  try {
    const body = schema.parse(await req.json());
    const result = await connectChannel({ actor, channelType: body.channelType });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    throw error;
  }
}, ['OWNER']);
