// @ts-nocheck
import { prisma } from '@gojo/db';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { AppError } from '@gojo/types';

import { formatISTDateKey, startOfIstDayUtc, todayIST } from '@/lib/tz';

function overlaps(checkIn, checkOut, from, to) {
  return checkIn < to && checkOut > from;
}

export async function getCalendarWindow(propertyId, fromKey?: string | null, toKey?: string | null) {
  const from = fromKey ?? todayIST();
  const to = toKey ?? formatISTDateKey(addDays(new Date(`${from}T00:00:00+05:30`), 6));

  if (differenceInCalendarDays(new Date(`${to}T00:00:00+05:30`), new Date(`${from}T00:00:00+05:30`)) > 90) {
    throw new AppError('VALIDATION_ERROR', 'Calendar window cannot exceed 90 days', 400);
  }

  const windowStart = startOfIstDayUtc(from);
  const windowEnd = startOfIstDayUtc(formatISTDateKey(addDays(new Date(`${to}T00:00:00+05:30`), 1)));

  const [rooms, reservations, guests, roomTypes] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId, deletedAt: null },
      orderBy: [{ roomTypeId: 'asc' }, { number: 'asc' }],
    }),
    prisma.reservation.findMany({
      where: { propertyId, deletedAt: null, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
      orderBy: { checkIn: 'asc' },
    }),
    prisma.guest.findMany({ where: { propertyId, deletedAt: null } }),
    prisma.roomType.findMany({ where: { propertyId, deletedAt: null } }),
  ]);

  return {
    from: windowStart.toISOString(),
    to: windowEnd.toISOString(),
    rooms: rooms.map((room) => {
      const roomReservations = reservations.filter((reservation) => reservation.roomId === room.id && overlaps(reservation.checkIn, reservation.checkOut, windowStart, windowEnd));
      return {
        roomId: room.id,
        roomNumber: room.number,
        roomType: roomTypes.find((roomType) => roomType.id === room.roomTypeId)?.name ?? 'Room',
        reservations: roomReservations.map((reservation) => ({
          id: reservation.id,
          bookingReference: reservation.bookingReference ?? reservation.id.slice(-8).toUpperCase(),
          guestName: guests.find((guest) => guest.id === reservation.guestId)?.fullName ?? 'Guest',
          roomNumber: room.number,
          roomType: roomTypes.find((roomType) => roomType.id === room.roomTypeId)?.name ?? 'Room',
          checkIn: reservation.checkIn.toISOString(),
          checkOut: reservation.checkOut.toISOString(),
          status: reservation.status,
          source: reservation.source,
          hasConflict: roomReservations.some((other) => other.id !== reservation.id && overlaps(other.checkIn, other.checkOut, reservation.checkIn, reservation.checkOut) && ['CONFIRMED', 'CHECKED_IN'].includes(other.status)),
        })),
      };
    }),
  };
}
