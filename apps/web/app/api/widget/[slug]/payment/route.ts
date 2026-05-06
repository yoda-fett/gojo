// @ts-nocheck
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getPropertyBySlug } from '@/lib/services/direct-booking';
import { startPaymentForHold } from '@/lib/services/upi-payment';

const schema = z.object({
  holdId: z.string().min(1),
  roomTypeId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  guestName: z.string().min(1),
  guestPhone: z.string().min(1),
  guestEmail: z.string().email().optional(),
});

type Context = { params: Promise<{ slug: string }> };

export async function POST(req: Request, context: Context) {
  const { slug } = await context.params;
  try {
    await getPropertyBySlug(slug);
    const body = schema.parse(await req.json());
    const result = await startPaymentForHold({
      holdId: body.holdId,
      roomTypeId: body.roomTypeId,
      checkIn: new Date(body.checkIn),
      checkOut: new Date(body.checkOut),
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      guestEmail: body.guestEmail,
    });
    return NextResponse.json({
      gatewayOrderId: result.gatewayOrderId,
      amount: result.amount,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
