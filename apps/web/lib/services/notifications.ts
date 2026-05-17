// @ts-nocheck
/**
 * Booking confirmation notifications (Story 7.3).
 *
 * Phase-2 stub: real WhatsApp / Resend / MSG91 providers are not wired.
 * Each channel is logged; NotificationLog rows are written so the audit
 * trail and dashboard alert affordances can be exercised. Replace the
 * provider shims with real SDK calls when vendors are confirmed.
 */
import { prisma } from '@gojo/db';
import { formatInTimeZone } from 'date-fns-tz';

const IST = 'Asia/Kolkata';

interface BookingNotificationContext {
  reservationId: string;
  propertyName: string;
  roomTypeName: string;
  bookingRef: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  checkIn: Date;
  checkOut: Date;
  amountPaid: number;
}

function whatsappBody(ctx: BookingNotificationContext) {
  const day = formatInTimeZone(ctx.checkIn, IST, 'dd MMM yyyy');
  return `Booking confirmed! Your reservation at ${ctx.propertyName} is confirmed. Room: ${ctx.roomTypeName}. Check-in: ${day}. Ref: ${ctx.bookingRef}. See you soon!`;
}

function emailBody(ctx: BookingNotificationContext) {
  return [
    `Booking reference: ${ctx.bookingRef}`,
    `Property: ${ctx.propertyName}`,
    `Room: ${ctx.roomTypeName}`,
    `Check-in: ${formatInTimeZone(ctx.checkIn, IST, 'dd MMM yyyy')}`,
    `Check-out: ${formatInTimeZone(ctx.checkOut, IST, 'dd MMM yyyy')}`,
    `Total paid: ₹${ctx.amountPaid.toLocaleString('en-IN')}`,
  ].join('\n');
}

async function sendWhatsapp(ctx: BookingNotificationContext) {
  console.info('[notifications] WHATSAPP →', ctx.guestPhone, whatsappBody(ctx));
  return { providerMessageId: `wa-${Date.now()}` };
}

async function sendEmail(ctx: BookingNotificationContext) {
  if (!ctx.guestEmail) throw new Error('No email');
  console.info('[notifications] EMAIL →', ctx.guestEmail, emailBody(ctx));
  return { providerMessageId: `em-${Date.now()}` };
}

async function sendSms(ctx: BookingNotificationContext) {
  console.info(
    '[notifications] SMS →',
    ctx.guestPhone,
    `Booking ${ctx.bookingRef} confirmed. Check-in ${formatInTimeZone(ctx.checkIn, IST, 'dd MMM')}.`,
  );
  return { providerMessageId: `sms-${Date.now()}` };
}

async function logAttempt(
  reservationId: string,
  propertyId: string,
  channel: 'WHATSAPP' | 'EMAIL' | 'SMS',
  fn: () => Promise<{ providerMessageId: string }>,
) {
  await prisma.notificationLog.upsert({
    where: { reservationId_channel: { reservationId, channel } },
    create: { reservationId, propertyId, channel, status: 'PENDING', attemptCount: 1, lastAttemptAt: new Date() },
    update: { status: 'PENDING', attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
  });
  try {
    const result = await fn();
    await prisma.notificationLog.update({
      where: { reservationId_channel: { reservationId, channel } },
      data: {
        status: 'SENT',
        providerMessageId: result.providerMessageId,
        confirmedAt: new Date(),
        errorReason: null,
      },
    });
    return true;
  } catch (error) {
    await prisma.notificationLog.update({
      where: { reservationId_channel: { reservationId, channel } },
      data: {
        status: 'FAILED',
        errorReason: error instanceof Error ? error.message : 'Unknown',
      },
    });
    return false;
  }
}

/** @gateExempt Async notification dispatch — system context, no Owner actor. */
export async function dispatchBookingConfirmation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) return { sent: 0 };

  const [property, roomType, guest, folioLines] = await Promise.all([
    prisma.property.findUnique({ where: { id: reservation.propertyId } }),
    prisma.roomType.findUnique({ where: { id: reservation.roomTypeId } }),
    prisma.guest.findUnique({ where: { id: reservation.guestId } }),
    prisma.folioLine.findMany({
      where: { propertyId: reservation.propertyId, chargeType: 'UPI_PAYMENT' },
      orderBy: { postedAt: 'desc' },
      take: 1,
    }),
  ]);

  if (!property || !roomType || !guest) return { sent: 0 };

  const amountPaid = folioLines[0] ? Math.abs(Number(folioLines[0].amount)) : 0;
  const ctx: BookingNotificationContext = {
    reservationId,
    propertyName: property.name,
    roomTypeName: roomType.name,
    bookingRef: reservation.bookingReference ?? reservation.id.slice(-8).toUpperCase(),
    guestName: guest.fullName,
    guestPhone: guest.phone,
    guestEmail: guest.email ?? null,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    amountPaid,
  };

  const propertyId = reservation.propertyId;
  const [whatsappOk, emailOk] = await Promise.all([
    logAttempt(reservationId, propertyId, 'WHATSAPP', () => sendWhatsapp(ctx)),
    ctx.guestEmail ? logAttempt(reservationId, propertyId, 'EMAIL', () => sendEmail(ctx)) : Promise.resolve(false),
  ]);

  let sent = (whatsappOk ? 1 : 0) + (emailOk ? 1 : 0);

  if (!whatsappOk) {
    const smsOk = await logAttempt(reservationId, propertyId, 'SMS', () => sendSms(ctx));
    if (smsOk) sent += 1;
  }

  if (sent === 0) {
    await prisma.alert.create({
      data: {
        propertyId,
        alertType: 'NOTIFICATION_DELIVERY_FAILED',
        severity: 'HIGH',
        message: `Booking confirmation not delivered to ${guest.fullName} — ${ctx.bookingRef}`,
        entityId: reservationId,
        entityType: 'RESERVATION',
      },
    });
  }

  return { sent };
}
