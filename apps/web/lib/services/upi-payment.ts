// @ts-nocheck
import crypto from 'node:crypto';

import { prisma, withRoomLock, writeAuditLog, withIdempotency } from '@gojo/db';
import { AppError } from '@gojo/types';
import { customAlphabet } from 'nanoid';

import { getLockRedis } from '@/lib/redis';
import { generateBookingReference } from '@/lib/utils/booking-ref';
import { nightsBetween } from '@/lib/services/direct-booking';

const orderIdAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const PAYMENT_PROVIDER = 'upi-mock';

export async function startPaymentForHold({
  holdId,
  guestName,
  guestPhone,
  guestEmail,
  checkIn,
  checkOut,
  roomTypeId,
}: {
  holdId: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  checkIn: Date;
  checkOut: Date;
  roomTypeId: string;
}) {
  const room = await prisma.room.findFirst({ where: { holdRef: holdId } });
  if (!room) throw new AppError('HOLD_NOT_FOUND', 'Hold not found', 404);
  if (!room.holdExpiresAt || room.holdExpiresAt < new Date()) {
    throw new AppError('HOLD_EXPIRED', 'Hold has expired', 410);
  }
  const roomType = await prisma.roomType.findFirst({ where: { id: roomTypeId, deletedAt: null } });
  if (!roomType) throw new AppError('NOT_FOUND', 'Room type not found', 404);

  const existing = await prisma.pendingPayment.findFirst({
    where: { holdId, status: 'PENDING' },
  });
  if (existing) {
    return {
      gatewayOrderId: existing.gatewayOrderId,
      amount: Number(existing.amount),
      expiresAt: room.holdExpiresAt,
    };
  }

  const nights = nightsBetween(checkIn, checkOut);
  const amount = Number(roomType.baseRate) * nights;
  const created = await initPendingPayment({
    holdId,
    propertyId: room.propertyId,
    roomId: room.id,
    roomTypeId,
    checkIn,
    checkOut,
    amount,
    guestName,
    guestPhone,
    guestEmail,
  });

  return { gatewayOrderId: created.gatewayOrderId, amount: Number(created.amount), expiresAt: room.holdExpiresAt };
}

/** @gateExempt Direct-booking customer flow — no Owner actor exists to gate on. */
export async function initPendingPayment({
  holdId,
  propertyId,
  roomId,
  roomTypeId,
  checkIn,
  checkOut,
  amount,
  guestName,
  guestPhone,
  guestEmail,
}: {
  holdId: string;
  propertyId: string;
  roomId: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  amount: number;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
}) {
  const gatewayOrderId = `UPI-${orderIdAlphabet()}`;
  const created = await prisma.pendingPayment.create({
    data: {
      propertyId,
      gatewayOrderId,
      holdId,
      roomId,
      roomTypeId,
      guestName,
      guestPhone,
      guestEmail: guestEmail ?? null,
      checkIn,
      checkOut,
      amount,
      status: 'PENDING',
    },
  });
  return created;
}

export async function getPendingPaymentByOrderId(gatewayOrderId: string) {
  const pp = await prisma.pendingPayment.findUnique({ where: { gatewayOrderId } });
  if (!pp) throw new AppError('PAYMENT_NOT_FOUND', 'Payment not found', 404);
  return pp;
}

export function verifyHmac(payload: string, signature: string, secret: string) {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

async function getActiveSecret(propertyId: string) {
  const row = await prisma.webhookSecret.findFirst({
    where: { propertyId, provider: PAYMENT_PROVIDER, isActive: true },
    orderBy: { activeFrom: 'desc' },
  });
  return row?.secret ?? null;
}

/** @gateExempt Inbound PSP webhook — no Owner actor; signature-verified at the boundary. */
export async function processPaymentWebhook({
  rawBody,
  signature,
  gatewayEventId,
  gatewayOrderId,
  status,
}: {
  rawBody: string;
  signature: string;
  gatewayEventId: string;
  gatewayOrderId: string;
  status: 'CONFIRMED' | 'FAILED';
}) {
  const pending = await prisma.pendingPayment.findUnique({ where: { gatewayOrderId } });
  if (!pending) throw new AppError('PAYMENT_NOT_FOUND', 'Payment not found', 404);

  const secret = await getActiveSecret(pending.propertyId);
  if (!secret || !verifyHmac(rawBody, signature, secret)) {
    throw new AppError('PAYMENT_SIGNATURE_INVALID', 'Invalid webhook signature', 401);
  }

  const idempotencyKey = `payment-webhook:v1:${gatewayEventId}`;
  return withIdempotency(idempotencyKey, prisma, async () => {
    if (status === 'FAILED') {
      await prisma.pendingPayment.update({
        where: { id: pending.id },
        data: { status: 'FAILED', gatewayEventId },
      });
      return { status: 'FAILED' as const };
    }

    const redis = getLockRedis();
    const result = await withRoomLock(pending.roomId, redis, prisma, async (tx) => {
      const room = await tx.room.findUnique({ where: { id: pending.roomId } });
      if (!room) throw new AppError('NOT_FOUND', 'Room not found', 404);
      if (!room.holdExpiresAt || room.holdExpiresAt.getTime() <= Date.now()) {
        throw new AppError('INVALID_TRANSITION', 'Room hold has expired or was not held', 409);
      }

      const guest = await tx.guest.create({
        data: {
          propertyId: pending.propertyId,
          guestCode: `WEB-${pending.id.slice(-6).toUpperCase()}`,
          fullName: pending.guestName,
          phone: pending.guestPhone,
          email: pending.guestEmail,
          consentGivenAt: new Date(),
        },
      });

      const nights = Math.max(
        1,
        Math.ceil((pending.checkOut.getTime() - pending.checkIn.getTime()) / 86_400_000),
      );
      const ratePerNight = Number(pending.amount) / nights;
      const bookingRef = generateBookingReference(new Date());

      const reservation = await tx.reservation.create({
        data: {
          propertyId: pending.propertyId,
          roomId: pending.roomId,
          roomTypeId: pending.roomTypeId,
          guestId: guest.id,
          bookingReference: bookingRef,
          checkIn: pending.checkIn,
          checkOut: pending.checkOut,
          status: 'CONFIRMED',
          source: 'DIRECT_BOOKING',
          rateSnapshot: {
            ratePerNight,
            total: Number(pending.amount),
            nights,
          },
        },
      });

      // Epic 15: occupancy is derived from the CONFIRMED reservation — only
      // the hold columns are cleared.
      await tx.room.update({
        where: { id: pending.roomId },
        data: { holdExpiresAt: null, holdRef: null },
      });

      const folio = await tx.folio.create({
        data: {
          propertyId: pending.propertyId,
          reservationId: reservation.id,
          guestId: guest.id,
          invoiceNumber: `INV-DRAFT-${reservation.id.slice(-8).toUpperCase()}`,
          status: 'OPEN',
        },
      });

      await tx.folioLine.create({
        data: {
          propertyId: pending.propertyId,
          folioId: folio.id,
          chargeType: 'ROOM',
          description: `Room charge × ${nights} night(s)`,
          amount: Number(pending.amount),
          taxAmount: 0,
          gstSlab: '0',
          postedAt: new Date(),
        },
      });

      await tx.folioLine.create({
        data: {
          propertyId: pending.propertyId,
          folioId: folio.id,
          chargeType: 'UPI_PAYMENT',
          description: `UPI payment ${gatewayOrderId}`,
          amount: -Number(pending.amount),
          taxAmount: 0,
          gstSlab: '0',
          postedAt: new Date(),
        },
      });

      await tx.pendingPayment.update({
        where: { id: pending.id },
        data: {
          status: 'CONFIRMED',
          gatewayEventId,
          confirmedAt: new Date(),
          reservationId: reservation.id,
        },
      });

      await writeAuditLog(tx, {
        userId: 'SYSTEM',
        propertyId: pending.propertyId,
        role: 'SYSTEM',
      } as never, {
        action: 'CHECK_IN',
        entityType: 'RESERVATION',
        entityId: reservation.id,
        metadata: { source: 'DIRECT_BOOKING', gatewayOrderId },
      });

      return { reservationId: reservation.id, bookingRef, folioId: folio.id };
    });

    return { status: 'CONFIRMED' as const, ...result };
  });
}
