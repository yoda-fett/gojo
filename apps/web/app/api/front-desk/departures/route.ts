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
      status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
      checkOut: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { checkOut: 'asc' },
  });

  const guestIds = Array.from(new Set(reservations.map((r) => r.guestId)));
  const roomIds = Array.from(new Set(reservations.map((r) => r.roomId)));
  const roomTypeIds = Array.from(new Set(reservations.map((r) => r.roomTypeId)));
  const reservationIds = reservations.map((r) => r.id);

  const [guests, rooms, roomTypes, folios] = await Promise.all([
    prisma.guest.findMany({ where: { id: { in: guestIds } }, select: { id: true, fullName: true } }),
    prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, number: true } }),
    prisma.roomType.findMany({ where: { id: { in: roomTypeIds } }, select: { id: true, name: true } }),
    reservationIds.length
      ? prisma.folio.findMany({ where: { reservationId: { in: reservationIds } }, select: { id: true, reservationId: true } })
      : Promise.resolve([]),
  ]);

  const folioIds = folios.map((f) => f.id);
  const folioLines = folioIds.length
    ? await prisma.folioLine.findMany({
        where: { folioId: { in: folioIds }, reversedAt: null },
        select: { folioId: true, amount: true, taxAmount: true },
      })
    : [];

  const totalByFolio = new Map<string, number>();
  for (const line of folioLines) {
    const prev = totalByFolio.get(line.folioId) ?? 0;
    totalByFolio.set(line.folioId, prev + Number(line.amount.toString()) + Number(line.taxAmount.toString()));
  }
  const totalByReservation = new Map<string, number>();
  for (const f of folios) {
    totalByReservation.set(f.reservationId, (totalByReservation.get(f.reservationId) ?? 0) + (totalByFolio.get(f.id) ?? 0));
  }

  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));
  const roomMap = new Map(rooms.map((r) => [r.id, r.number]));
  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  const items = reservations.map((r) => {
    const nights = Math.max(1, Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / (24 * 60 * 60 * 1000)));
    return {
      reservationId: r.id,
      bookingReference: r.bookingReference,
      guestName: guestMap.get(r.guestId) ?? 'Guest',
      roomNumber: roomMap.get(r.roomId) ?? '',
      roomTypeName: roomTypeMap.get(r.roomTypeId) ?? 'Room',
      folioTotal: totalByReservation.get(r.id) ?? 0,
      checkOut: r.checkOut,
      status: r.status,
      nights,
    };
  });

  return NextResponse.json({ items });
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
