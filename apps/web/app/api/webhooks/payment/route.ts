// @ts-nocheck
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { processPaymentWebhook } from '@/lib/services/upi-payment';
import { dispatchBookingConfirmation } from '@/lib/services/notifications';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-gojo-signature') ?? '';
  let payload: { gatewayEventId?: string; gatewayOrderId?: string; status?: string } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Invalid JSON' }, { status: 400 });
  }
  if (!payload.gatewayEventId || !payload.gatewayOrderId || !payload.status) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Missing fields' }, { status: 400 });
  }
  const status = payload.status === 'CONFIRMED' ? 'CONFIRMED' : 'FAILED';

  try {
    const result = await processPaymentWebhook({
      rawBody,
      signature,
      gatewayEventId: payload.gatewayEventId,
      gatewayOrderId: payload.gatewayOrderId,
      status,
    });

    if (result.status === 'CONFIRMED' && 'reservationId' in result) {
      // Fire-and-forget; do not block webhook ack
      dispatchBookingConfirmation(result.reservationId).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError && error.code === 'PAYMENT_SIGNATURE_INVALID') {
      return NextResponse.json({ code: error.code, message: error.message }, { status: 401 });
    }
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
