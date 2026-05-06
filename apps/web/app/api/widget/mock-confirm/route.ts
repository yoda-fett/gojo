// @ts-nocheck
import crypto from 'node:crypto';

import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { processPaymentWebhook } from '@/lib/services/upi-payment';
import { dispatchBookingConfirmation } from '@/lib/services/notifications';

const schema = z.object({ gatewayOrderId: z.string().min(1) });

const PAYMENT_PROVIDER = 'upi-mock';

/**
 * Dev-only helper that simulates the UPI gateway calling our webhook.
 * Generates a valid HMAC signature using the property's active secret
 * and forwards through the same processPaymentWebhook code path that
 * production webhooks use.
 */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const pending = await prisma.pendingPayment.findUnique({ where: { gatewayOrderId: body.gatewayOrderId } });
    if (!pending) {
      return NextResponse.json({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' }, { status: 404 });
    }

    let secret = await prisma.webhookSecret.findFirst({
      where: { propertyId: pending.propertyId, provider: PAYMENT_PROVIDER, isActive: true },
      orderBy: { activeFrom: 'desc' },
    });
    if (!secret) {
      secret = await prisma.webhookSecret.create({
        data: {
          propertyId: pending.propertyId,
          provider: PAYMENT_PROVIDER,
          secret: crypto.randomBytes(32).toString('hex'),
          isActive: true,
        },
      });
    }

    const eventId = `evt-${crypto.randomBytes(8).toString('hex')}`;
    const rawBody = JSON.stringify({
      gatewayEventId: eventId,
      gatewayOrderId: body.gatewayOrderId,
      status: 'CONFIRMED',
    });
    const signature = crypto.createHmac('sha256', secret.secret).update(rawBody).digest('hex');

    const result = await processPaymentWebhook({
      rawBody,
      signature,
      gatewayEventId: eventId,
      gatewayOrderId: body.gatewayOrderId,
      status: 'CONFIRMED',
    });

    if (result.status === 'CONFIRMED' && 'reservationId' in result) {
      dispatchBookingConfirmation(result.reservationId).catch(() => undefined);
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
