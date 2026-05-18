// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { startOfIstDayUtc, endOfIstDayUtc, todayIST } from '@/lib/tz';

export const GET = withAuth(async (_req, actor) => {
  const today = todayIST();
  const dayStart = startOfIstDayUtc(today);
  const dayEnd = endOfIstDayUtc(today);

  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId: actor.propertyId,
      deletedAt: null,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkIn: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { checkIn: 'asc' },
  });

  const guestIds = Array.from(new Set(reservations.map((r) => r.guestId)));
  const roomIds = Array.from(new Set(reservations.map((r) => r.roomId)));
  const roomTypeIds = Array.from(new Set(reservations.map((r) => r.roomTypeId)));
  const [guests, rooms, roomTypes] = await Promise.all([
    prisma.guest.findMany({ where: { id: { in: guestIds } }, select: { id: true, fullName: true } }),
    prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, number: true } }),
    prisma.roomType.findMany({ where: { id: { in: roomTypeIds } }, select: { id: true, name: true } }),
  ]);
  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));
  const roomMap = new Map(rooms.map((r) => [r.id, r.number]));
  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  const items = reservations.map((r) => ({
    reservationId: r.id,
    bookingReference: r.bookingReference,
    guestName: guestMap.get(r.guestId) ?? 'Guest',
    roomNumber: roomMap.get(r.roomId) ?? '',
    roomTypeName: roomTypeMap.get(r.roomTypeId) ?? 'Room',
    source: r.source,
    checkIn: r.checkIn,
    status: r.status,
  }));

  return NextResponse.json({ items });
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
