// @ts-nocheck
import { AppError } from '@gojo/types';
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { getPendingPaymentByOrderId } from '@/lib/services/upi-payment';

type Context = { params: Promise<{ orderId: string }> };

export async function GET(_req: Request, context: Context) {
  const { orderId } = await context.params;
  try {
    const pp = await getPendingPaymentByOrderId(orderId);
    let bookingRef: string | null = null;
    if (pp.reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: pp.reservationId },
        select: { bookingReference: true },
      });
      bookingRef = reservation?.bookingReference ?? null;
    }
    return NextResponse.json({
      status: pp.status,
      gatewayOrderId: pp.gatewayOrderId,
      reservationId: pp.reservationId,
      bookingRef,
      amount: Number(pp.amount),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
