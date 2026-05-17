// @ts-nocheck
import { prisma, checkSubscriptionGate, withRoomLock } from '@gojo/db';
import { AppError } from '@gojo/types';
import { addDays, differenceInCalendarDays } from 'date-fns';

import { getRedisClient } from '@/lib/redis';
import { decryptGuestId, encryptGuestId, maskGuestId } from '@/lib/services/guest-id-crypto';
import { fallbackBookingReference, generateBookingReference } from '@/lib/utils/booking-ref';
import { formatISTDateKey, startOfIstDayUtc, todayIST } from '@/lib/tz';

const ACTIVE_RESERVATION_STATUSES = ['CONFIRMED', 'CHECKED_IN'];
const DEFAULT_NO_SHOW_CUTOFF_HOUR_IST = 18;

function numberize(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function nextIstDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+05:30`);
  date.setUTCDate(date.getUTCDate() + 1);
  return formatISTDateKey(date);
}

function endOfIstDayUtc(dateKey: string) {
  return new Date(`${dateKey}T23:59:59.999+05:30`);
}

function overlaps(checkIn: Date, checkOut: Date, rangeStart: Date, rangeEnd: Date) {
  return checkIn < rangeEnd && checkOut > rangeStart;
}

function computeNights(checkIn: Date, checkOut: Date) {
  return Math.max(1, differenceInCalendarDays(checkOut, checkIn));
}

function buildInvoiceNumber(propertyId: string, count: number) {
  return `INV-DRAFT-${propertyId.slice(-6)}-${String(count + 1).padStart(5, '0')}`;
}

function deriveDisplayStatus(reservation: { status: string; checkIn: Date; checkOut: Date }) {
  const today = todayIST();
  if (reservation.status === 'CONFIRMED' && formatISTDateKey(reservation.checkIn) === today) {
    return 'ARRIVING_TODAY';
  }
  if (reservation.status === 'CHECKED_IN' && formatISTDateKey(reservation.checkOut) === today) {
    return 'CHECKING_OUT_TODAY';
  }
  return reservation.status;
}

function mapSourceLabel(source: string, otaRef?: string | null) {
  if (source === 'WALK_IN') return 'Walk-in';
  if (source === 'DIRECT_BOOKING') return 'Direct';
  if (source === 'OTA') return otaRef?.split(':')[0] || 'OTA';
  return source;
}

async function loadReservationBundle(propertyId: string, filters?: { reservationIds?: string[] }) {
  const where = {
    propertyId,
    deletedAt: null,
    ...(filters?.reservationIds ? { id: { in: filters.reservationIds } } : {}),
  };

  const [reservations, guests, rooms, roomTypes, folios, folioLines, cancellationPolicies] = await Promise.all([
    prisma.reservation.findMany({ where, orderBy: [{ checkIn: 'asc' }, { createdAt: 'asc' }] }),
    prisma.guest.findMany({ where: { propertyId, deletedAt: null } }),
    prisma.room.findMany({ where: { propertyId, deletedAt: null } }),
    prisma.roomType.findMany({ where: { propertyId, deletedAt: null } }),
    prisma.folio.findMany({ where: { propertyId, deletedAt: null } }),
    prisma.folioLine.findMany({ where: { propertyId }, orderBy: { postedAt: 'asc' } }),
    prisma.cancellationPolicy.findMany({ where: { propertyId, deletedAt: null } }),
  ]);

  return { reservations, guests, rooms, roomTypes, folios, folioLines, cancellationPolicies };
}

function toReservationListItem(reservation, bundle) {
  const guest = bundle.guests.find((item) => item.id === reservation.guestId);
  const room = bundle.rooms.find((item) => item.id === reservation.roomId);
  const roomType = bundle.roomTypes.find((item) => item.id === reservation.roomTypeId);
  return {
    id: reservation.id,
    bookingReference: reservation.bookingReference ?? fallbackBookingReference(reservation.id, reservation.createdAt),
    guestName: guest?.fullName ?? 'Guest',
    guestPhone: guest?.phone ? `+91 XXXXXX${guest.phone.replace(/\D/g, '').slice(-4)}` : '',
    roomNumber: room?.number ?? 'TBD',
    roomType: roomType?.name ?? 'Room',
    roomId: reservation.roomId,
    roomTypeId: reservation.roomTypeId,
    checkIn: reservation.checkIn.toISOString(),
    checkOut: reservation.checkOut.toISOString(),
    status: deriveDisplayStatus(reservation),
    source: reservation.source,
    sourceLabel: mapSourceLabel(reservation.source, reservation.otaRef),
    nights: computeNights(reservation.checkIn, reservation.checkOut),
    stateVersion: reservation.stateVersion,
  };
}

export async function listReservations(actor, input: {
  status?: string[];
  source?: string[];
  roomType?: string[];
  from?: string | null;
  to?: string | null;
  limit?: number;
  cursor?: string | null;
  includeCancelled?: boolean;
} = {}) {
  const bundle = await loadReservationBundle(actor.propertyId);
  let items = bundle.reservations;

  if (!input.includeCancelled && (!input.status || input.status.length === 0)) {
    items = items.filter((reservation) => !['CANCELLED', 'NO_SHOW'].includes(reservation.status));
  }

  if (input.status?.length) {
    const statuses = new Set(input.status);
    items = items.filter((reservation) => statuses.has(deriveDisplayStatus(reservation)) || statuses.has(reservation.status));
  }

  if (input.source?.length) {
    const sources = new Set(input.source);
    items = items.filter((reservation) => sources.has(reservation.source));
  }

  if (input.roomType?.length) {
    const roomTypes = new Set(input.roomType);
    items = items.filter((reservation) => roomTypes.has(reservation.roomTypeId));
  }

  if (input.from) {
    const from = startOfIstDayUtc(input.from);
    items = items.filter((reservation) => reservation.checkIn >= from);
  }

  if (input.to) {
    const to = endOfIstDayUtc(input.to);
    items = items.filter((reservation) => reservation.checkIn <= to);
  }

  items = items.sort((left, right) => {
    const checkInDiff = left.checkIn.getTime() - right.checkIn.getTime();
    if (checkInDiff !== 0) return checkInDiff;
    return left.id.localeCompare(right.id);
  });

  if (input.cursor) {
    const cursorIndex = items.findIndex((reservation) => reservation.id === input.cursor);
    if (cursorIndex >= 0) {
      items = items.slice(cursorIndex + 1);
    }
  }

  const limit = input.limit ?? 50;
  const page = items.slice(0, limit + 1);
  const nextCursor = page.length > limit ? page[limit].id : null;

  return {
    reservations: page.slice(0, limit).map((reservation) => toReservationListItem(reservation, bundle)),
    nextCursor,
    total: items.length,
  };
}

export async function searchReservations(actor, q: string) {
  const query = q.trim();
  if (query.length < 2) {
    throw new AppError('VALIDATION_ERROR', 'Search query must be at least 2 characters', 400);
  }

  const bundle = await loadReservationBundle(actor.propertyId);
  const digits = query.replace(/\D/g, '').slice(-10);
  const lower = query.toLowerCase();
  const reservations = bundle.reservations.filter((reservation) => {
    const guest = bundle.guests.find((item) => item.id === reservation.guestId);
    const bookingReference = reservation.bookingReference ?? fallbackBookingReference(reservation.id, reservation.createdAt);
    return (
      bookingReference.toLowerCase().startsWith(lower) ||
      guest?.fullName.toLowerCase().includes(lower) ||
      (digits.length >= 2 && guest?.phone.replace(/\D/g, '').endsWith(digits))
    );
  }).slice(0, 20);

  return {
    reservations: reservations.map((reservation) => toReservationListItem(reservation, bundle)),
    nextCursor: null,
    total: reservations.length,
  };
}

async function getOrCreateGuest(tx, actor, input) {
  const existing = await tx.guest.findFirst({
    where: {
      propertyId: actor.propertyId,
      phone: input.phone,
      deletedAt: null,
    },
  });

  if (existing) {
    return tx.guest.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName,
        email: input.email ?? existing.email,
        idType: input.idType ?? existing.idType,
        idNumber: input.idNumber ? encryptGuestId(input.idNumber) : existing.idNumber,
        stateVersion: { increment: 1 },
      },
    });
  }

  const count = await tx.guest.count({ where: { propertyId: actor.propertyId } });
  return tx.guest.create({
    data: {
      propertyId: actor.propertyId,
      guestCode: `GST-${actor.propertyId.slice(-4).toUpperCase()}-${String(count + 1).padStart(4, '0')}`,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      idType: input.idType ?? null,
      idNumber: input.idNumber ? encryptGuestId(input.idNumber) : null,
      consentGivenAt: new Date(),
    },
  });
}

async function ensureOpenFolio(tx, actor, reservationId, guestId) {
  const existing = await tx.folio.findFirst({
    where: {
      propertyId: actor.propertyId,
      reservationId,
      deletedAt: null,
    },
  });

  if (existing) {
    return existing;
  }

  const count = await tx.folio.count({ where: { propertyId: actor.propertyId } });
  return tx.folio.create({
    data: {
      propertyId: actor.propertyId,
      reservationId,
      guestId,
      invoiceNumber: buildInvoiceNumber(actor.propertyId, count),
      status: 'OPEN',
    },
  });
}

async function postRoomCharges(tx, actor, folioId, checkIn, checkOut, nightlyRate) {
  const nights = computeNights(checkIn, checkOut);
  const lines = Array.from({ length: nights }, (_, index) => {
    const night = addDays(checkIn, index);
    return tx.folioLine.create({
      data: {
        propertyId: actor.propertyId,
        folioId,
        chargeType: 'ROOM_CHARGE',
        description: `Room charge - ${formatISTDateKey(night)}`,
        amount: nightlyRate,
        taxAmount: 0,
        gstSlab: '0%',
        postedAt: night,
      },
    });
  });

  await Promise.all(lines);
}

async function ensureRoomAvailable(tx, actor, roomId, checkIn, checkOut, excludeReservationId?: string) {
  const conflict = await tx.reservation.findFirst({
    where: {
      propertyId: actor.propertyId,
      roomId,
      deletedAt: null,
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      status: { in: ACTIVE_RESERVATION_STATUSES },
    },
    orderBy: { checkIn: 'asc' },
  });

  if (conflict && overlaps(conflict.checkIn, conflict.checkOut, checkIn, checkOut)) {
    throw new AppError('ROOM_UNAVAILABLE', 'Room already reserved for this period', 409, {
      details: { conflictingReservationId: conflict.id },
    });
  }
}

function validateRateAgainstRoomType(roomType, rate, belowFloorOverride?: boolean) {
  if (rate < numberize(roomType.floorRate) && !belowFloorOverride) {
    throw new AppError('VALIDATION_ERROR', 'Below floor rate requires explicit confirmation', 400);
  }
}

async function maybeAuditBelowFloorOverride(tx, actor, reservationId, roomType, enteredRate, belowFloorOverride) {
  const floorRate = numberize(roomType.floorRate);
  if (enteredRate >= floorRate || !belowFloorOverride) {
    return;
  }

  if (!['OWNER', 'MANAGER'].includes(actor.role)) {
    throw new AppError('FORBIDDEN', 'Front Desk cannot apply below-floor overrides', 403);
  }

  await tx.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'RESERVATION',
      entityId: reservationId,
      action: 'RATE_OVERRIDE_BELOW_FLOOR',
      actorId: actor.userId,
      actorRole: actor.role,
      metadata: {
        enteredRate,
        floorRate,
        delta: floorRate - enteredRate,
      },
    },
  });
}

async function createReservationAudit(tx, actor, action, reservationId, metadata) {
  await tx.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'RESERVATION',
      entityId: reservationId,
      action,
      actorId: actor.userId,
      actorRole: actor.role,
      metadata,
    },
  });
}

async function createFolioAudit(tx, actor, folioId, action, metadata) {
  await tx.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'FOLIO',
      entityId: folioId,
      action,
      actorId: actor.userId,
      actorRole: actor.role,
      metadata,
    },
  });
}

export async function getAvailableRooms(actor, input) {
  const rooms = await prisma.room.findMany({
    where: {
      propertyId: actor.propertyId,
      roomTypeId: input.roomTypeId,
      deletedAt: null,
      state: { in: ['AVAILABLE', 'CLEAN', 'DIRTY', 'RESERVED'] },
    },
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
  });

  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId: actor.propertyId,
      deletedAt: null,
      status: { in: ACTIVE_RESERVATION_STATUSES },
    },
  });

  return {
    rooms: rooms
      .filter((room) =>
        !reservations.some((reservation) =>
          reservation.roomId === room.id &&
          overlaps(reservation.checkIn, reservation.checkOut, input.checkIn, input.checkOut),
        ),
      )
      .map((room) => ({
        roomId: room.id,
        roomNumber: room.number,
        floor: room.floor,
      })),
  };
}

export async function createWalkInReservation(actor, input) {
  await checkSubscriptionGate(actor, 'RESERVATION_CREATE', prisma);
  const redis = getRedisClient();

  return withRoomLock(input.roomId, redis as never, prisma, async (tx) => {
    const roomType = await tx.roomType.findFirst({
      where: { id: input.roomTypeId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!roomType) {
      throw new AppError('NOT_FOUND', 'Room type not found', 404);
    }

    await ensureRoomAvailable(tx, actor, input.roomId, input.checkIn, input.checkOut);
    validateRateAgainstRoomType(roomType, input.rate, input.belowFloorOverride);

    const guest = await getOrCreateGuest(tx, actor, {
      fullName: input.guestName,
      phone: input.guestPhone,
    });

    const reservation = await tx.reservation.create({
      data: {
        propertyId: actor.propertyId,
        roomId: input.roomId,
        roomTypeId: input.roomTypeId,
        guestId: guest.id,
        bookingReference: generateBookingReference(),
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        status: 'CHECKED_IN',
        source: 'WALK_IN',
        rateSnapshot: { nightlyRate: input.rate, currency: 'INR' },
        selectedCancellationPolicyId: input.selectedCancellationPolicyId ?? null,
      },
    });

    const folio = await ensureOpenFolio(tx, actor, reservation.id, guest.id);
    await postRoomCharges(tx, actor, folio.id, input.checkIn, input.checkOut, input.rate);
    await tx.room.update({
      where: { id: input.roomId },
      data: {
        state: 'OCCUPIED',
        stateVersion: { increment: 1 },
      },
    });

    await createReservationAudit(tx, actor, 'RESERVATION_CREATED', reservation.id, {
      bookingReference: reservation.bookingReference,
      source: reservation.source,
      nightlyRate: input.rate,
    });
    await maybeAuditBelowFloorOverride(tx, actor, reservation.id, roomType, input.rate, input.belowFloorOverride);

    return reservation;
  });
}

export async function getReservationDetail(actor, reservationId) {
  const bundle = await loadReservationBundle(actor.propertyId, { reservationIds: [reservationId] });
  const reservation = bundle.reservations[0];

  if (!reservation) {
    throw new AppError('NOT_FOUND', 'Reservation not found', 404);
  }

  const guest = bundle.guests.find((item) => item.id === reservation.guestId);
  const room = bundle.rooms.find((item) => item.id === reservation.roomId);
  const roomType = bundle.roomTypes.find((item) => item.id === reservation.roomTypeId);
  const folio = bundle.folios.find((item) => item.reservationId === reservation.id && item.deletedAt === null) ?? null;
  const lines = folio ? bundle.folioLines.filter((item) => item.folioId === folio.id) : [];
  const rawGuestId = decryptGuestId(guest?.idNumber);

  const totalCharges = lines.filter((line) => numberize(line.amount) > 0).reduce((sum, line) => sum + numberize(line.amount), 0);
  const totalPayments = Math.abs(lines.filter((line) => numberize(line.amount) < 0).reduce((sum, line) => sum + numberize(line.amount), 0));
  const balanceDue = totalCharges - totalPayments;

  return {
    id: reservation.id,
    bookingReference: reservation.bookingReference ?? fallbackBookingReference(reservation.id, reservation.createdAt),
    status: deriveDisplayStatus(reservation),
    rawStatus: reservation.status,
    source: reservation.source,
    sourceLabel: mapSourceLabel(reservation.source, reservation.otaRef),
    checkIn: reservation.checkIn.toISOString(),
    checkOut: reservation.checkOut.toISOString(),
    stateVersion: reservation.stateVersion,
    nightlyRate: numberize(reservation.rateSnapshot?.nightlyRate ?? reservation.rateSnapshot?.ratePerNight ?? 0),
    guest: {
      id: guest?.id,
      fullName: guest?.fullName ?? 'Guest',
      phone: guest?.phone ?? '',
      email: guest?.email ?? null,
      idType: guest?.idType ?? null,
      idMasked: maskGuestId(rawGuestId),
    },
    room: {
      id: room?.id,
      number: room?.number ?? 'TBD',
      state: room?.state ?? 'AVAILABLE',
      stateVersion: room?.stateVersion ?? 0,
      roomType: roomType?.name ?? 'Room',
      roomTypeId: roomType?.id ?? reservation.roomTypeId,
    },
    folio: folio
      ? {
          id: folio.id,
          status: folio.status,
          invoiceNumber: folio.invoiceNumber,
          lines: lines.map((line) => ({
            id: line.id,
            chargeType: line.chargeType,
            description: line.description,
            amount: numberize(line.amount),
            postedAt: line.postedAt.toISOString(),
            reversalOf: line.reversalOf ?? null,
          })),
          totalCharges,
          totalPayments,
          balanceDue,
        }
      : null,
  };
}

export async function revealReservationGuestId(actor, reservationId) {
  await checkSubscriptionGate(actor, 'guest_id.reveal', prisma);
  if (!['OWNER', 'MANAGER'].includes(actor.role)) {
    throw new AppError('FORBIDDEN', 'Only owners and managers can reveal guest ID', 403);
  }

  const detail = await getReservationDetail(actor, reservationId);
  const guest = await prisma.guest.findFirst({
    where: { id: detail.guest.id, propertyId: actor.propertyId, deletedAt: null },
  });
  const raw = decryptGuestId(guest?.idNumber);

  await prisma.auditLog.create({
    data: {
      propertyId: actor.propertyId,
      entityType: 'GUEST',
      entityId: guest?.id ?? reservationId,
      action: 'GUEST_ID_REVEALED',
      actorId: actor.userId,
      actorRole: actor.role,
    },
  });

  return {
    value: raw,
    expiresAt: Date.now() + 30_000,
  };
}

export async function checkInReservation(actor, reservationId, input) {
  await checkSubscriptionGate(actor, 'CHECK_IN', prisma);
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
  });

  if (!reservation) {
    throw new AppError('NOT_FOUND', 'Reservation not found', 404);
  }

  if (reservation.status === 'CHECKED_IN') {
    throw new AppError('ALREADY_CHECKED_IN', 'Reservation is already checked in', 409);
  }

  if (!['CONFIRMED'].includes(reservation.status)) {
    throw new AppError('INVALID_TRANSITION', `Cannot check in reservation from ${reservation.status}`, 422);
  }

  const redis = getRedisClient();
  return withRoomLock(reservation.roomId, redis as never, prisma, async (tx) => {
    const current = await tx.reservation.findFirst({
      where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!current) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
    if (current.stateVersion !== input.stateVersion) {
      throw new AppError('CONFLICT', 'Reservation was updated by someone else. Refresh and try again.', 409);
    }

    const guest = await tx.guest.findFirst({
      where: { id: current.guestId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!guest) {
      throw new AppError('NOT_FOUND', 'Guest not found', 404);
    }

    await tx.guest.update({
      where: { id: guest.id },
      data: {
        idType: input.idType,
        idNumber: encryptGuestId(input.idNumber),
        stateVersion: { increment: 1 },
      },
    });

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'CHECKED_IN',
        stateVersion: { increment: 1 },
      },
    });

    await tx.room.update({
      where: { id: current.roomId },
      data: {
        state: 'OCCUPIED',
        stateVersion: { increment: 1 },
      },
    });

    await ensureOpenFolio(tx, actor, current.id, current.guestId);
    await createReservationAudit(tx, actor, 'CHECK_IN', current.id, { idType: input.idType });

    return updated;
  });
}

export async function getReservationFolio(actor, reservationId) {
  const detail = await getReservationDetail(actor, reservationId);
  if (!detail.folio) {
    throw new AppError('NOT_FOUND', 'Folio not found', 404);
  }

  return {
    folioId: detail.folio.id,
    status: detail.folio.status,
    lines: detail.folio.lines,
    totalCharges: detail.folio.totalCharges,
    totalPayments: detail.folio.totalPayments,
    balanceDue: detail.folio.balanceDue,
  };
}

export async function addFolioLine(actor, folioId, input) {
  await checkSubscriptionGate(actor, 'folio.post_charge', prisma);
  const folio = await prisma.folio.findFirst({
    where: { id: folioId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!folio) {
    throw new AppError('NOT_FOUND', 'Folio not found', 404);
  }
  if (folio.status === 'CLOSED') {
    throw new AppError('FOLIO_CLOSED', 'Folio is closed', 409);
  }
  if (actor.role === 'FRONT_DESK' && input.chargeType !== 'PAYMENT') {
    throw new AppError('FORBIDDEN', 'Front Desk can only record payments', 403);
  }

  const signedAmount =
    input.chargeType === 'PAYMENT' || input.chargeType === 'DISCOUNT'
      ? -Math.abs(input.amount)
      : Math.abs(input.amount);

  const line = await prisma.folioLine.create({
    data: {
      propertyId: actor.propertyId,
      folioId,
      chargeType: input.chargeType === 'DISCOUNT' ? 'DISCOUNT' : input.chargeType === 'PAYMENT' ? 'PAYMENT' : 'EXTRA_CHARGE',
      description: input.description,
      amount: signedAmount,
      taxAmount: 0,
      gstSlab: '0%',
      postedAt: new Date(),
    },
  });

  await createFolioAudit(
    prisma,
    actor,
    folioId,
    input.chargeType === 'PAYMENT' ? 'CASH_PAYMENT_RECORDED' : 'FOLIO_LINE_ADDED',
    { lineId: line.id, amount: signedAmount, note: input.note ?? null },
  );

  return getReservationFolioByFolio(actor, folioId);
}

async function getReservationFolioByFolio(actor, folioId) {
  const folio = await prisma.folio.findFirst({
    where: { id: folioId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!folio) throw new AppError('NOT_FOUND', 'Folio not found', 404);
  const lines = await prisma.folioLine.findMany({ where: { folioId, propertyId: actor.propertyId }, orderBy: { postedAt: 'asc' } });
  const totalCharges = lines.filter((line) => numberize(line.amount) > 0).reduce((sum, line) => sum + numberize(line.amount), 0);
  const totalPayments = Math.abs(lines.filter((line) => numberize(line.amount) < 0).reduce((sum, line) => sum + numberize(line.amount), 0));
  return {
    folioId,
    lines: lines.map((line) => ({
      id: line.id,
      description: line.description,
      amount: numberize(line.amount),
      chargeType: line.chargeType,
      createdAt: line.createdAt.toISOString(),
      postedAt: line.postedAt.toISOString(),
      reversalOf: line.reversalOf ?? null,
    })),
    totalCharges,
    totalPayments,
    balanceDue: totalCharges - totalPayments,
  };
}

export async function voidFolioLine(actor, folioId, lineId) {
  await checkSubscriptionGate(actor, 'folio.post_charge', prisma);
  if (!['OWNER', 'MANAGER'].includes(actor.role)) {
    throw new AppError('FORBIDDEN', 'Only owners and managers can void folio lines', 403);
  }

  const folio = await prisma.folio.findFirst({
    where: { id: folioId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!folio) throw new AppError('NOT_FOUND', 'Folio not found', 404);
  if (folio.status === 'CLOSED') throw new AppError('FOLIO_CLOSED', 'Folio is closed', 409);

  const original = await prisma.folioLine.findFirst({
    where: { id: lineId, folioId, propertyId: actor.propertyId },
  });
  if (!original) throw new AppError('NOT_FOUND', 'Folio line not found', 404);
  if (original.reversedAt || original.reversalOf) {
    throw new AppError('ALREADY_VOIDED', 'Folio line already voided', 409);
  }

  return prisma.$transaction(async (tx) => {
    await tx.folioLine.update({
      where: { id: original.id },
      data: { reversedAt: new Date(), reversedBy: actor.userId },
    });
    const voidLine = await tx.folioLine.create({
      data: {
        propertyId: actor.propertyId,
        folioId,
        chargeType: 'TAX_ADJUSTMENT',
        description: `Void: ${original.description}`,
        amount: -numberize(original.amount),
        taxAmount: 0,
        gstSlab: '0%',
        reversalOf: original.id,
        postedAt: new Date(),
      },
    });
    await createFolioAudit(tx, actor, folioId, 'FOLIO_LINE_VOIDED', {
      originalLineId: original.id,
      originalAmount: numberize(original.amount),
      voidLineId: voidLine.id,
    });
    return getReservationFolioByFolio(actor, folioId);
  });
}

export async function checkOutReservation(actor, reservationId, input) {
  await checkSubscriptionGate(actor, 'CHECK_OUT', prisma);
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!reservation) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
  if (reservation.status !== 'CHECKED_IN') {
    throw new AppError('INVALID_TRANSITION', `Cannot check out reservation from ${reservation.status}`, 422);
  }

  const redis = getRedisClient();
  return withRoomLock(reservation.roomId, redis as never, prisma, async (tx) => {
    const current = await tx.reservation.findFirst({
      where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!current) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
    if (current.stateVersion !== input.stateVersion) {
      throw new AppError('CONFLICT', 'Reservation was updated by someone else. Refresh and try again.', 409);
    }

    const folio = await ensureOpenFolio(tx, actor, current.id, current.guestId);
    const folioSummary = await getReservationFolioByFolio(actor, folio.id);
    if (folioSummary.balanceDue > 0 && !input.acknowledgedOutstandingBalance) {
      throw new AppError('VALIDATION_ERROR', 'Outstanding balance must be acknowledged before check-out', 400);
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: 'CHECKED_OUT',
        stateVersion: { increment: 1 },
      },
    });

    await tx.room.update({
      where: { id: current.roomId },
      data: {
        state: 'DIRTY',
        stateVersion: { increment: 1 },
      },
    });

    await tx.folio.update({
      where: { id: folio.id },
      data: {
        status: 'CLOSED',
        settledAt: new Date(),
        closedBy: actor.userId,
        stateVersion: { increment: 1 },
      },
    });

    await createReservationAudit(tx, actor, 'CHECK_OUT', current.id, {
      folioId: folio.id,
      acknowledgedOutstandingBalance: Boolean(input.acknowledgedOutstandingBalance),
    });

    return updated;
  });
}

async function enqueueRoomChangeSms(payload) {
  try {
    const redis = getRedisClient();
    if ('set' in redis) {
      await redis.set(`notification:room-change:${payload.reservationId}:${Date.now()}`, JSON.stringify(payload), 'EX', 3600);
    }
  } catch {
    // Fire-and-forget by design for Phase 1.
  }
}

export async function amendReservation(actor, reservationId, input) {
  await checkSubscriptionGate(actor, 'RESERVATION_AMEND', prisma);
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!reservation) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
  if (!['CONFIRMED'].includes(reservation.status)) {
    throw new AppError('INVALID_TRANSITION', `Cannot amend reservation from ${reservation.status}`, 422);
  }

  const targetRoomId = input.roomId ?? reservation.roomId;
  const redis = getRedisClient();
  return withRoomLock(targetRoomId, redis as never, prisma, async (tx) => {
    const current = await tx.reservation.findFirst({
      where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!current) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
    if (current.stateVersion !== input.stateVersion) {
      throw new AppError('CONFLICT', 'Reservation was updated by someone else. Refresh and try again.', 409);
    }

    const nextCheckIn = input.checkIn ?? current.checkIn;
    const nextCheckOut = input.checkOut ?? current.checkOut;
    const nextRoomTypeId = input.roomTypeId ?? current.roomTypeId;
    const nextRoomId = input.roomId ?? current.roomId;

    if (nextRoomId !== current.roomId) {
      await ensureRoomAvailable(tx, actor, nextRoomId, nextCheckIn, nextCheckOut, current.id);
    }

    if (input.rate !== undefined) {
      const roomType = await tx.roomType.findFirst({
        where: { id: nextRoomTypeId, propertyId: actor.propertyId, deletedAt: null },
      });
      if (!roomType) throw new AppError('NOT_FOUND', 'Room type not found', 404);
      validateRateAgainstRoomType(roomType, input.rate, input.belowFloorOverride);
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        roomId: nextRoomId,
        roomTypeId: nextRoomTypeId,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        rateSnapshot: input.rate !== undefined ? { nightlyRate: input.rate, currency: 'INR' } : current.rateSnapshot,
        stateVersion: { increment: 1 },
      },
    });

    await createReservationAudit(tx, actor, 'RESERVATION_AMENDED', current.id, {
      before: {
        checkIn: current.checkIn.toISOString(),
        checkOut: current.checkOut.toISOString(),
        roomId: current.roomId,
        roomTypeId: current.roomTypeId,
        rateSnapshot: current.rateSnapshot,
      },
      after: {
        checkIn: updated.checkIn.toISOString(),
        checkOut: updated.checkOut.toISOString(),
        roomId: updated.roomId,
        roomTypeId: updated.roomTypeId,
        rateSnapshot: updated.rateSnapshot,
      },
    });
    const effectiveRoomType = await tx.roomType.findFirst({
      where: { id: nextRoomTypeId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (effectiveRoomType && input.rate !== undefined) {
      await maybeAuditBelowFloorOverride(tx, actor, current.id, effectiveRoomType, input.rate, input.belowFloorOverride);
    }

    if (nextRoomId !== current.roomId) {
      await createReservationAudit(tx, actor, 'ROOM_REASSIGNED', current.id, {
        fromRoomId: current.roomId,
        toRoomId: nextRoomId,
      });
      enqueueRoomChangeSms({
        type: 'ROOM_CHANGE_SMS',
        propertyId: actor.propertyId,
        reservationId: current.id,
        fromRoomId: current.roomId,
        toRoomId: nextRoomId,
      }).catch(() => undefined);
    }

    return updated;
  });
}

function getCancellationFeeAmount(policy, nightlyRate) {
  if (!policy) return 0;
  if (policy.penaltyType === 'PERCENTAGE') {
    return Math.round((nightlyRate * numberize(policy.penaltyValue ?? 0)) / 100);
  }
  return numberize(policy.penaltyValue ?? 0);
}

export async function cancelReservation(actor, reservationId, input) {
  await checkSubscriptionGate(actor, 'RESERVATION_CANCEL', prisma);
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!reservation) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
  if (!['CONFIRMED'].includes(reservation.status)) {
    throw new AppError('INVALID_TRANSITION', `Cannot cancel reservation from ${reservation.status}`, 422);
  }

  const redis = getRedisClient();
  return withRoomLock(reservation.roomId, redis as never, prisma, async (tx) => {
    const current = await tx.reservation.findFirst({
      where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!current) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
    if (current.stateVersion !== input.stateVersion) {
      throw new AppError('CONFLICT', 'Reservation was updated by someone else. Refresh and try again.', 409);
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: input.reason,
        stateVersion: { increment: 1 },
      },
    });

    const nightlyRate = numberize(current.rateSnapshot?.nightlyRate ?? current.rateSnapshot?.ratePerNight ?? 0);
    const policy = current.selectedCancellationPolicyId
      ? await tx.cancellationPolicy.findFirst({ where: { id: current.selectedCancellationPolicyId, propertyId: actor.propertyId, deletedAt: null } })
      : null;
    const cancellationFeeAmount = input.cancellationFeeAmount ?? getCancellationFeeAmount(policy, nightlyRate);
    const folio = await ensureOpenFolio(tx, actor, current.id, current.guestId);

    if (cancellationFeeAmount > 0) {
      await tx.folioLine.create({
        data: {
          propertyId: actor.propertyId,
          folioId: folio.id,
          chargeType: 'EXTRA_CHARGE',
          description: 'Cancellation fee',
          amount: cancellationFeeAmount,
          taxAmount: 0,
          gstSlab: '0%',
          postedAt: new Date(),
        },
      });
    }

    await createReservationAudit(tx, actor, 'RESERVATION_CANCELLED', current.id, {
      reason: input.reason,
      cancellationFeeAmount,
    });

    return updated;
  });
}

export async function markReservationNoShow(actor, reservationId, input) {
  await checkSubscriptionGate(actor, 'RESERVATION_NO_SHOW', prisma);
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!reservation) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
  if (reservation.status !== 'CONFIRMED') {
    throw new AppError('INVALID_TRANSITION', `Cannot mark no-show from ${reservation.status}`, 422);
  }

  const today = todayIST();
  if (formatISTDateKey(reservation.checkIn) !== today) {
    throw new AppError('VALIDATION_ERROR', 'No-show is only available on the check-in day', 400);
  }

  const nowIstHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()));
  if (nowIstHour < DEFAULT_NO_SHOW_CUTOFF_HOUR_IST) {
    throw new AppError('VALIDATION_ERROR', 'No-show cutoff has not been reached yet', 400);
  }

  const redis = getRedisClient();
  return withRoomLock(reservation.roomId, redis as never, prisma, async (tx) => {
    const current = await tx.reservation.findFirst({
      where: { id: reservationId, propertyId: actor.propertyId, deletedAt: null },
    });
    if (!current) throw new AppError('NOT_FOUND', 'Reservation not found', 404);
    if (current.stateVersion !== input.stateVersion) {
      throw new AppError('CONFLICT', 'Reservation was updated by someone else. Refresh and try again.', 409);
    }

    const updated = await tx.reservation.update({
      where: { id: current.id },
      data: {
        status: 'NO_SHOW',
        noShowAt: new Date(),
        stateVersion: { increment: 1 },
      },
    });

    await tx.room.update({
      where: { id: current.roomId },
      data: {
        state: 'AVAILABLE',
        stateVersion: { increment: 1 },
      },
    });

    await createReservationAudit(tx, actor, 'NO_SHOW_MARKED', current.id, null);
    return updated;
  });
}
