// @ts-nocheck
import { withIdempotency } from '@gojo/db';
import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { acquireHold } from '@/lib/services/direct-booking';

const schema = z.object({
  roomTypeId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guestSession: z.string().min(1),
});

type Context = { params: Promise<{ slug: string }> };

export async function POST(req: Request, context: Context) {
  const { slug } = await context.params;
  try {
    const body = schema.parse(await req.json());
    const checkIn = new Date(body.checkIn);
    const checkOut = new Date(body.checkOut);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Invalid date range' }, { status: 400 });
    }

    const key = `widget-hold:v1:${slug}:${body.guestSession}:${body.roomTypeId}:${body.checkIn}:${body.checkOut}`;
    const result = await withIdempotency(key, prisma, async () => {
      const hold = await acquireHold({
        slug,
        roomTypeId: body.roomTypeId,
        checkIn,
        checkOut,
      });
      return {
        holdId: hold.holdId,
        roomId: hold.roomId,
        propertyId: hold.propertyId,
        roomTypeId: hold.roomTypeId,
        expiresAt: hold.expiresAt.toISOString(),
        checkIn: hold.checkIn.toISOString(),
        checkOut: hold.checkOut.toISOString(),
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
