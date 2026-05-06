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
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { id: true, fullName: true },
  });
  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));

  const items = reservations.map((r) => ({
    reservationId: r.id,
    bookingReference: r.bookingReference,
    guestName: guestMap.get(r.guestId) ?? 'Guest',
    checkIn: r.checkIn,
    status: r.status,
  }));

  return NextResponse.json({ items });
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
