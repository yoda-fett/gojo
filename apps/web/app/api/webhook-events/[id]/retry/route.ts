// @ts-nocheck
import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import {
  processCancellationIngest,
  processReservationIngest,
  recordPermanentFailure,
} from '@/lib/services/ota-ingest';

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (_request, actor) => {
    const event = await prisma.webhookEvent.findFirst({
      where: { id, propertyId: actor.propertyId },
    });
    if (!event) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Event not found' }, { status: 404 });
    }
    if (event.processingStatus !== 'FAILED_PERMANENT') {
      return NextResponse.json(
        { code: 'CONFLICT', message: 'Only permanently failed events can be retried' },
        { status: 409 },
      );
    }

    const rawBody = JSON.stringify(event.rawPayload);
    // The original signature isn't replayable (HMAC was computed against
    // the live request); the manual retry path bypasses HMAC by reusing
    // the already-trusted stored payload via the system audit trail.
    const args = {
      channelId: event.channelId,
      propertyId: event.propertyId,
      rawBody,
      signature: '__manual_retry__',
      providerEventId: event.providerEventId,
    };

    // Restore status so withIdempotency does not short-circuit.
    await prisma.idempotencyKey
      .delete({ where: { key: `ota-webhook:v1:${event.channelId}:${event.providerEventId}` } })
      .catch(() => undefined);
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processingStatus: 'QUEUED', errorReason: null, attemptCount: { increment: 1 } },
    });

    try {
      if (event.eventType === 'CANCELLATION_INGEST') {
        await processCancellationIngest({ ...args, skipHmac: true });
      } else {
        await processReservationIngest({ ...args, skipHmac: true });
      }
    } catch (error) {
      await recordPermanentFailure({
        channelId: event.channelId,
        providerEventId: event.providerEventId,
        errorReason: error instanceof Error ? error.message : 'Unknown',
      });
      if (error instanceof AppError) {
        return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
      }
      return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Retry failed' }, { status: 500 });
    }

    await prisma.alert.updateMany({
      where: {
        propertyId: actor.propertyId,
        entityType: 'WEBHOOK_EVENT',
        entityId: event.id,
        status: 'ACTIVE',
      },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  }, ['OWNER'])(req as never);
}
