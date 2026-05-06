// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { startOfIstDayUtc, endOfIstDayUtc, todayIST } from '@/lib/tz';

function deriveVisualState(
  room: { state: string },
  context: { arrivingToday: boolean; departingToday: boolean; checkedIn: boolean },
) {
  if (room.state === 'OUT_OF_ORDER') return 'out_of_order';
  if (room.state === 'MAINTENANCE') return 'maintenance';
  if (room.state === 'DIRTY') return 'dirty';
  if (context.departingToday) return 'departing';
  if (context.checkedIn) return 'in_house';
  if (context.arrivingToday) return 'arriving';
  if (room.state === 'CLEAN' || room.state === 'AVAILABLE') return 'vacant_clean';
  if (room.state === 'HELD') return 'held';
  return 'vacant_clean';
}

export const GET = withAuth(async (_req, actor) => {
  const today = todayIST();
  const dayStart = startOfIstDayUtc(today);
  const dayEnd = endOfIstDayUtc(today);

  const [rooms, roomTypes, reservations] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { number: 'asc' },
    }),
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.reservation.findMany({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        OR: [
          { status: 'CHECKED_IN' },
          { status: 'CONFIRMED', checkIn: { gte: dayStart, lte: dayEnd } },
        ],
      },
    }),
  ]);

  const guestIds = Array.from(new Set(reservations.map((r) => r.guestId)));
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { id: true, fullName: true },
  });
  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));

  const reservationByRoom = new Map<string, (typeof reservations)[number]>();
  for (const r of reservations) {
    if (!reservationByRoom.has(r.roomId)) reservationByRoom.set(r.roomId, r);
  }

  const groups = roomTypes.map((rt) => {
    const inType = rooms.filter((r) => r.roomTypeId === rt.id);
    return {
      roomTypeId: rt.id,
      roomTypeName: rt.name,
      rooms: inType.map((room) => {
        const reservation = reservationByRoom.get(room.id);
        const arrivingToday =
          !!reservation &&
          reservation.status === 'CONFIRMED' &&
          reservation.checkIn >= dayStart &&
          reservation.checkIn <= dayEnd;
        const departingToday =
          !!reservation &&
          reservation.status === 'CHECKED_IN' &&
          reservation.checkOut >= dayStart &&
          reservation.checkOut <= dayEnd;
        const checkedIn = !!reservation && reservation.status === 'CHECKED_IN';
        return {
          roomId: room.id,
          roomNumber: room.number,
          state: room.state,
          stateVersion: room.stateVersion,
          guestName: reservation ? (guestMap.get(reservation.guestId) ?? null) : null,
          reservationId: reservation?.id ?? null,
          visualState: deriveVisualState(room, { arrivingToday, departingToday, checkedIn }),
        };
      }),
    };
  });

  return NextResponse.json({ groups });
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
