// @ts-nocheck
/**
 * OTA reservation + cancellation ingest (Stories 8.2, 8.3, 8.4).
 *
 * Phase 2 simplification: BullMQ is not wired. The Vercel webhook route
 * processes synchronously inside `withIdempotency` after returning fast.
 * Retry logic is implemented as in-process retries with exponential
 * backoff; if exhausted, the event is marked FAILED_PERMANENT and a
 * High-severity alert is raised. Replace with BullMQ before production.
 */
import {
  prisma,
  verifyOtaWebhookSignature,
  withRoomLock,
  withIdempotency,
  writeAuditLog,
} from '@gojo/db';
import { AppError } from '@gojo/types';

import { getRedisClient } from '@/lib/redis';
import { generateBookingReference } from '@/lib/utils/booking-ref';
import { publishSseEvent } from '@/lib/services/sse-publisher';
import { isRoomBlockedForRange } from '@/lib/services/room-blocks';

export interface OtaReservationPayload {
  otaRef: string;
  roomId: string;
  roomTypeId: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  checkIn: string;
  checkOut: string;
  rateSnapshot: { ratePerNight: number; total: number; nights: number };
}

export interface OtaCancellationPayload {
  otaRef: string;
}

const SYSTEM_ACTOR = { userId: 'SYSTEM', role: 'SYSTEM' } as const;

export type WebhookEventType = 'RESERVATION_INGEST' | 'CANCELLATION_INGEST';

export function detectEventType(payload: Record<string, unknown>): WebhookEventType {
  const t = String(payload.event_type ?? payload.eventType ?? '').toLowerCase();
  if (t === 'cancellation' || t === 'cancel' || t === 'reservation.cancelled') {
    return 'CANCELLATION_INGEST';
  }
  return 'RESERVATION_INGEST';
}

/** @gateExempt Inbound OTA webhook — signature-verified at boundary; no Owner actor. */
export async function logWebhookEvent({
  channelId,
  propertyId,
  providerEventId,
  eventType,
  rawPayload,
}: {
  channelId: string;
  propertyId: string;
  providerEventId: string;
  eventType: WebhookEventType;
  rawPayload: unknown;
}) {
  return prisma.webhookEvent.upsert({
    where: { channelId_providerEventId: { channelId, providerEventId } },
    create: {
      channelId,
      propertyId,
      providerEventId,
      eventType,
      rawPayload: rawPayload as never,
      processingStatus: 'QUEUED',
    },
    update: {
      attemptCount: { increment: 1 },
    },
  });
}

async function markStatus(
  channelId: string,
  providerEventId: string,
  status: 'PROCESSED' | 'FAILED' | 'FAILED_PERMANENT' | 'SIGNATURE_INVALID',
  extras: { errorReason?: string; reservationId?: string } = {},
) {
  await prisma.webhookEvent.update({
    where: { channelId_providerEventId: { channelId, providerEventId } },
    data: {
      processingStatus: status,
      processedAt: status === 'PROCESSED' ? new Date() : undefined,
      errorReason: extras.errorReason,
      reservationId: extras.reservationId,
    },
  });
}

/** @gateExempt Inbound OTA webhook ingest — no Owner actor; gated upstream. */
export async function processReservationIngest({
  channelId,
  propertyId,
  rawBody,
  signature,
  providerEventId,
  skipHmac = false,
}: {
  channelId: string;
  propertyId: string;
  rawBody: string;
  signature: string;
  providerEventId: string;
  skipHmac?: boolean;
}) {
  const valid = skipHmac || (await verifyOtaWebhookSignature(prisma, channelId, rawBody, signature));
  if (!valid) {
    await markStatus(channelId, providerEventId, 'SIGNATURE_INVALID', {
      errorReason: 'HMAC verification failed',
    });
    throw new AppError('PAYMENT_SIGNATURE_INVALID', 'Invalid webhook signature', 401);
  }

  const idempotencyKey = `ota-webhook:v1:${channelId}:${providerEventId}`;
  return withIdempotency(idempotencyKey, prisma, async () => {
    const payload = JSON.parse(rawBody) as OtaReservationPayload;
    const checkIn = new Date(payload.checkIn);
    const checkOut = new Date(payload.checkOut);

    const block = await isRoomBlockedForRange(payload.roomId, checkIn, checkOut);
    if (block) {
      throw new AppError(
        'ROOM_BLOCKED',
        `Room blocked: ${block.blockType} until ${block.endDate.toISOString().slice(0, 10)}`,
        409,
      );
    }

    const redis = getRedisClient();
    const result = await withRoomLock(payload.roomId, redis as never, prisma, async (tx) => {
      const room = await tx.room.findUnique({ where: { id: payload.roomId } });
      if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);
      if (room.state !== 'AVAILABLE') {
        throw new AppError('ROOM_UNAVAILABLE', `Room state=${room.state}`, 409);
      }

      const guest = await tx.guest.create({
        data: {
          propertyId,
          guestCode: `OTA-${providerEventId.slice(-6).toUpperCase()}`,
          fullName: payload.guestName,
          phone: payload.guestPhone,
          email: payload.guestEmail,
          consentGivenAt: new Date(),
        },
      });

      const bookingRef = generateBookingReference(new Date());
      const reservation = await tx.reservation.create({
        data: {
          propertyId,
          roomId: payload.roomId,
          roomTypeId: payload.roomTypeId,
          guestId: guest.id,
          bookingReference: bookingRef,
          checkIn,
          checkOut,
          status: 'CONFIRMED',
          source: 'OTA',
          otaRef: payload.otaRef,
          rateSnapshot: payload.rateSnapshot as never,
        },
      });

      const updatedRoom = await tx.room.update({
        where: { id: payload.roomId },
        data: { state: 'OCCUPIED' },
      });

      await writeAuditLog(tx, { ...SYSTEM_ACTOR, propertyId } as never, {
        action: 'CHECK_IN',
        entityType: 'RESERVATION',
        entityId: reservation.id,
        metadata: { source: 'OTA', channelId, otaRef: payload.otaRef },
      });

      return { reservationId: reservation.id, bookingRef, roomId: updatedRoom.id, stateVersion: updatedRoom.stateVersion };
    });

    await markStatus(channelId, providerEventId, 'PROCESSED', { reservationId: result.reservationId });
    await publishSseEvent(propertyId, {
      entityType: 'Room',
      entityId: result.roomId,
      stateVersion: result.stateVersion,
      state: 'OCCUPIED',
      eventType: 'OTA_RESERVATION',
    });
    return result;
  });
}

/** @gateExempt Inbound OTA cancellation webhook — no Owner actor; gated upstream. */
export async function processCancellationIngest({
  channelId,
  propertyId,
  rawBody,
  signature,
  providerEventId,
  skipHmac = false,
}: {
  channelId: string;
  propertyId: string;
  rawBody: string;
  signature: string;
  providerEventId: string;
  skipHmac?: boolean;
}) {
  const valid = skipHmac || (await verifyOtaWebhookSignature(prisma, channelId, rawBody, signature));
  if (!valid) {
    await markStatus(channelId, providerEventId, 'SIGNATURE_INVALID', {
      errorReason: 'HMAC verification failed',
    });
    throw new AppError('PAYMENT_SIGNATURE_INVALID', 'Invalid webhook signature', 401);
  }

  const idempotencyKey = `ota-webhook:v1:${channelId}:${providerEventId}`;
  return withIdempotency(idempotencyKey, prisma, async () => {
    const payload = JSON.parse(rawBody) as OtaCancellationPayload;
    const reservation = await prisma.reservation.findFirst({
      where: { propertyId, otaRef: payload.otaRef, deletedAt: null },
    });
    if (!reservation || (reservation.status !== 'CONFIRMED' && reservation.status !== 'CHECKED_IN')) {
      await markStatus(channelId, providerEventId, 'PROCESSED', {
        errorReason: 'Reservation not found or already cancelled',
      });
      return { skipped: true };
    }

    if (reservation.status === 'CHECKED_IN') {
      const guest = await prisma.guest.findUnique({ where: { id: reservation.guestId } });
      await prisma.alert.create({
        data: {
          propertyId,
          alertType: 'CANCELLATION_FOR_CHECKED_IN_GUEST',
          severity: 'HIGH',
          message: `Cancellation received for checked-in guest ${guest?.fullName ?? ''} — ${reservation.bookingReference ?? reservation.id}`,
          entityId: reservation.id,
          entityType: 'RESERVATION',
        },
      });
      await markStatus(channelId, providerEventId, 'PROCESSED', { reservationId: reservation.id });
      return { alerted: true, reservationId: reservation.id };
    }

    const redis = getRedisClient();
    const result = await withRoomLock(reservation.roomId, redis as never, prisma, async (tx) => {
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'OTA_CANCELLATION' },
      });
      const updatedRoom = await tx.room.update({
        where: { id: reservation.roomId },
        data: { state: 'AVAILABLE' },
      });
      await writeAuditLog(tx, { ...SYSTEM_ACTOR, propertyId } as never, {
        action: 'RESERVATION_CANCELLED',
        entityType: 'RESERVATION',
        entityId: reservation.id,
        before: { status: 'CONFIRMED' },
        after: { status: 'CANCELLED', cancelReason: 'OTA_CANCELLATION' },
        metadata: { channelId, otaRef: payload.otaRef },
      });
      return { reservationId: reservation.id, roomId: updatedRoom.id, stateVersion: updatedRoom.stateVersion };
    });

    await markStatus(channelId, providerEventId, 'PROCESSED', { reservationId: result.reservationId });
    await publishSseEvent(propertyId, {
      entityType: 'Room',
      entityId: result.roomId,
      stateVersion: result.stateVersion,
      state: 'AVAILABLE',
      eventType: 'OTA_CANCELLATION',
    });
    return { cancelled: true, ...result };
  });
}

/** @gateExempt OTA failure-path system handler — no Owner actor. */
export async function recordPermanentFailure({
  channelId,
  providerEventId,
  errorReason,
}: {
  channelId: string;
  providerEventId: string;
  errorReason: string;
}) {
  const event = await prisma.webhookEvent.findUnique({
    where: { channelId_providerEventId: { channelId, providerEventId } },
  });
  if (!event) return;
  await prisma.webhookEvent.update({
    where: { channelId_providerEventId: { channelId, providerEventId } },
    data: { processingStatus: 'FAILED_PERMANENT', errorReason },
  });
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  await prisma.alert.create({
    data: {
      propertyId: event.propertyId,
      alertType: 'OTA_INGEST_PERMANENTLY_FAILED',
      severity: 'HIGH',
      message: `${channel?.channelName ?? 'OTA'} sync failed for event ${providerEventId}. Gojo is no longer retrying. Retry manually from the Channels screen.`,
      entityId: event.id,
      entityType: 'WEBHOOK_EVENT',
    },
  });
}
