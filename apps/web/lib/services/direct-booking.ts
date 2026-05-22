// @ts-nocheck
import { prisma, withRoomLock, writeAuditLog } from '@gojo/db';
import { AppError } from '@gojo/types';
import { addMinutes, differenceInCalendarDays } from 'date-fns';
import { customAlphabet } from 'nanoid';

import { getLockRedis } from '@/lib/redis';
import { isRoomBlockedForRange } from '@/lib/services/room-blocks';

const slugAlphabet = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 6);

const HOLD_DURATION_MINUTES = 10;

const ACTIVE_RESERVATION_STATUSES = ['CONFIRMED', 'CHECKED_IN'];

function slugifyName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export async function generateUniqueBookingSlug(propertyName: string) {
  const base = slugifyName(propertyName) || 'stay';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? `${base}-${slugAlphabet()}` : `${base}-${slugAlphabet()}`;
    const existing = await prisma.property.findUnique({ where: { bookingSlug: candidate } });
    if (!existing) return candidate;
  }
  throw new AppError('CONFLICT', 'Could not generate unique booking slug', 409);
}

export async function getPropertyBySlug(slug: string) {
  const property = await prisma.property.findFirst({
    where: { bookingSlug: slug, deletedAt: null },
  });
  if (!property) {
    throw new AppError('INVALID_BOOKING_SLUG', 'Booking link not found', 404);
  }
  if (!property.directBookingEnabled) {
    throw new AppError('DIRECT_BOOKING_DISABLED', 'Direct booking is not available', 403);
  }
  return property;
}

export async function listAvailability(
  slug: string,
  checkIn: Date,
  checkOut: Date,
) {
  const property = await getPropertyBySlug(slug);

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id, deletedAt: null },
    orderBy: { name: 'asc' },
  });

  const rooms = await prisma.room.findMany({
    where: { propertyId: property.id, deletedAt: null },
  });

  const overlapping = await prisma.reservation.findMany({
    where: {
      propertyId: property.id,
      deletedAt: null,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { roomId: true },
  });
  const occupiedRoomIds = new Set(overlapping.map((r) => r.roomId));

  const blocked = await prisma.roomBlock.findMany({
    where: {
      propertyId: property.id,
      deletedAt: null,
      startDate: { lte: checkOut },
      endDate: { gte: checkIn },
      roomId: { in: rooms.map((r) => r.id) },
    },
    select: { roomId: true },
  });
  const blockedRoomIds = new Set(blocked.map((r) => r.roomId));
  const now = new Date();

  return {
    propertyId: property.id,
    propertyName: property.name,
    roomTypes: roomTypes.map((rt) => {
      const availableRooms = rooms.filter(
        (r) =>
          r.roomTypeId === rt.id &&
          !occupiedRoomIds.has(r.id) &&
          !blockedRoomIds.has(r.id) &&
          (!r.holdExpiresAt || r.holdExpiresAt < now),
      );
      return {
        roomTypeId: rt.id,
        name: rt.name,
        description: rt.description,
        maxOccupancy: rt.maxOccupancy,
        ratePerNight: Number(rt.baseRate),
        availableRooms: availableRooms.length,
        photos: [] as string[],
      };
    }),
  };
}

/** @gateExempt Direct-booking customer flow — no Owner actor exists to gate on. */
export async function acquireHold({
  slug,
  roomTypeId,
  checkIn,
  checkOut,
}: {
  slug: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
}) {
  const property = await getPropertyBySlug(slug);

  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId: property.id,
      deletedAt: null,
      status: { in: ACTIVE_RESERVATION_STATUSES },
      roomTypeId,
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { roomId: true },
  });
  const taken = new Set(reservations.map((r) => r.roomId));
  const now = new Date();

  const candidates = await prisma.room.findMany({
    where: {
      propertyId: property.id,
      roomTypeId,
      deletedAt: null,
    },
    orderBy: { number: 'asc' },
  });
  let candidate: (typeof candidates)[number] | undefined;
  for (const room of candidates) {
    if (taken.has(room.id)) continue;
    if (room.holdExpiresAt && room.holdExpiresAt >= now) continue;
    if (await isRoomBlockedForRange(room.id, checkIn, checkOut)) continue;
    candidate = room;
    break;
  }
  if (!candidate) {
    throw new AppError('NO_ROOMS_AVAILABLE', 'No rooms available for selected dates', 409);
  }

  const holdExpiresAt = addMinutes(now, HOLD_DURATION_MINUTES);
  const holdRef = `HOLD-${slugAlphabet()}`;

  const redis = getLockRedis();
  return withRoomLock(candidate.id, redis, prisma, async (tx) => {
    const fresh = await tx.room.findUnique({ where: { id: candidate.id } });
    if (!fresh || (fresh.holdExpiresAt && fresh.holdExpiresAt > now)) {
      throw new AppError('NO_ROOMS_AVAILABLE', 'Room no longer available', 409);
    }
    // Epic 15: a hold is the holdExpiresAt/holdRef pair — no room-state value.
    await tx.room.update({
      where: { id: candidate.id },
      data: { holdExpiresAt, holdRef },
    });
    return {
      holdId: holdRef,
      roomId: candidate.id,
      propertyId: property.id,
      roomTypeId,
      expiresAt: holdExpiresAt,
      checkIn,
      checkOut,
    };
  });
}

/** @gateExempt Cron sweep — system context, no Owner actor. */
export async function sweepExpiredHolds() {
  const now = new Date();
  // Epic 15: "held" is derived from holdExpiresAt — an expired hold is already
  // not-held the instant it lapses. This sweep is now a tidiness job that
  // clears the stale hold columns.
  const stale = await prisma.room.findMany({
    where: {
      holdExpiresAt: { lt: now },
    },
    select: { id: true, propertyId: true, holdRef: true },
  });

  for (const room of stale) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.room.findUnique({ where: { id: room.id } });
      if (!fresh || !fresh.holdExpiresAt || fresh.holdExpiresAt >= now) return;
      await tx.room.update({
        where: { id: room.id },
        data: { holdExpiresAt: null, holdRef: null },
      });
      await writeAuditLog(tx, {
        userId: 'SYSTEM',
        propertyId: room.propertyId,
        role: 'SYSTEM',
      } as never, {
        action: 'HOLD_EXPIRED',
        entityType: 'ROOM',
        entityId: room.id,
        metadata: { holdRef: room.holdRef },
      });
    });
  }
  return stale.length;
}

export function nightsBetween(checkIn: Date, checkOut: Date) {
  return Math.max(1, differenceInCalendarDays(checkOut, checkIn));
}
