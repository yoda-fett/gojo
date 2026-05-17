// @ts-nocheck
import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import {
  detectEventType,
  logWebhookEvent,
  processCancellationIngest,
  processReservationIngest,
  recordPermanentFailure,
} from '@/lib/services/ota-ingest';

const MAX_ATTEMPTS = 3;
const TRANSIENT_ERROR_CODES = new Set(['LOCK_TIMEOUT', 'IDEMPOTENCY_CONFLICT']);

type Context = { params: Promise<{ channelId: string }> };

export async function POST(req: Request, context: Context) {
  const { channelId } = await context.params;
  const rawBody = await req.text();
  const signature = req.headers.get('x-webhook-signature') ?? '';
  const providerEventId = req.headers.get('x-event-id') ?? '';

  if (!providerEventId) {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Missing x-event-id' }, { status: 400 });
  }

  const channel = await prisma.channel.findFirst({
    where: { id: channelId, deletedAt: null },
  });
  if (!channel) {
    return NextResponse.json({ code: 'CHANNEL_NOT_FOUND', message: 'Channel not found' }, { status: 401 });
  }

  // Story 10.3 AC1: paused channels reject inbound webhooks with 402.
  // Log the rejection so a future Phase-3 retry queue can replay it.
  if (channel.pausedAt) {
    let pausedPayload: Record<string, unknown> = {};
    try { pausedPayload = JSON.parse(rawBody); } catch { /* keep empty */ }
    try {
      await prisma.webhookEvent.create({
        data: {
          channelId,
          propertyId: channel.propertyId,
          providerEventId,
          eventType: 'PAUSED_REJECTED',
          rawPayload: pausedPayload,
          processingStatus: 'CHANNEL_PAUSED',
        },
      });
    } catch {
      // Best-effort log — don't fail the 402 because audit insert failed.
    }
    return NextResponse.json(
      { code: 'CHANNEL_PAUSED', message: 'Channel paused — trial expiring; convert to resume' },
      { status: 402 },
    );
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = detectEventType(parsed);

  await logWebhookEvent({
    channelId,
    propertyId: channel.propertyId,
    providerEventId,
    eventType,
    rawPayload: parsed,
  });

  // Phase 2: process inline since BullMQ is not wired. Retry transient
  // errors in-process up to MAX_ATTEMPTS; mark FAILED_PERMANENT thereafter.
  let lastError: AppError | Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const args = { channelId, propertyId: channel.propertyId, rawBody, signature, providerEventId };
      if (eventType === 'CANCELLATION_INGEST') {
        await processCancellationIngest(args);
      } else {
        await processReservationIngest(args);
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (error instanceof AppError && error.code === 'PAYMENT_SIGNATURE_INVALID') {
        return NextResponse.json({ code: error.code, message: error.message }, { status: 401 });
      }
      const transient = error instanceof AppError && TRANSIENT_ERROR_CODES.has(error.code);
      if (!transient || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }

  await recordPermanentFailure({
    channelId,
    providerEventId,
    errorReason: lastError?.message ?? 'Unknown',
  });
  if (lastError instanceof AppError) {
    return NextResponse.json({ code: lastError.code, message: lastError.message }, { status: lastError.statusCode });
  }
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
}
