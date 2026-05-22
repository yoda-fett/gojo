// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { startOfIstDayUtc, endOfIstDayUtc, todayIST } from '@/lib/tz';

export const GET = withAuth(async (_req, actor) => {
  const today = todayIST();
  const dayStart = startOfIstDayUtc(today);
  const dayEnd = endOfIstDayUtc(today);

  const [totalRooms, inHouse, arriving, departing, needsCleaning] = await Promise.all([
    prisma.room.count({ where: { propertyId: actor.propertyId, deletedAt: null } }),
    prisma.reservation.count({
      where: { propertyId: actor.propertyId, deletedAt: null, status: 'CHECKED_IN' },
    }),
    prisma.reservation.count({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        status: 'CONFIRMED',
        checkIn: { gte: dayStart, lte: dayEnd },
      },
    }),
    prisma.reservation.count({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        status: 'CHECKED_IN',
        checkOut: { gte: dayStart, lte: dayEnd },
      },
    }),
    prisma.room.count({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        housekeepingStatus: 'DIRTY',
      },
    }),
  ]);

  return NextResponse.json({
    totalRooms,
    inHouse,
    arrivingToday: arriving,
    departingToday: departing,
    needsCleaning,
    fetchedAt: new Date().toISOString(),
  });
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
