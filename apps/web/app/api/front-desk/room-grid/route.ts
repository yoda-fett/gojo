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

  const [rooms, roomTypes, reservations, recentDepartures, futureArrivals] = await Promise.all([
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
    // For DIRTY rooms with no active/incoming reservation, surface the last
    // departed guest. Looking back 30 days is plenty — any older and the
    // room would have been cleaned in the meantime.
    prisma.reservation.findMany({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        status: 'CHECKED_OUT',
        checkOut: { gte: new Date(dayStart.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { checkOut: 'desc' },
    }),
    // Future CONFIRMED arrivals (beyond today) so vacant_clean rooms can
    // surface the next guest landing.
    prisma.reservation.findMany({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        status: 'CONFIRMED',
        checkIn: { gt: dayEnd },
      },
      orderBy: { checkIn: 'asc' },
    }),
  ]);

  const guestIds = Array.from(
    new Set([
      ...reservations.map((r) => r.guestId),
      ...recentDepartures.map((r) => r.guestId),
      ...futureArrivals.map((r) => r.guestId),
    ]),
  );
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { id: true, fullName: true },
  });
  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));

  const reservationByRoom = new Map<string, (typeof reservations)[number]>();
  for (const r of reservations) {
    if (!reservationByRoom.has(r.roomId)) reservationByRoom.set(r.roomId, r);
  }
  // Most-recent departure per room — `recentDepartures` is already sorted desc.
  const lastDepartureByRoom = new Map<string, (typeof recentDepartures)[number]>();
  for (const r of recentDepartures) {
    if (!lastDepartureByRoom.has(r.roomId)) lastDepartureByRoom.set(r.roomId, r);
  }
  // Earliest future arrival per room — `futureArrivals` is sorted asc.
  const nextArrivalByRoom = new Map<string, (typeof futureArrivals)[number]>();
  for (const r of futureArrivals) {
    if (!nextArrivalByRoom.has(r.roomId)) nextArrivalByRoom.set(r.roomId, r);
  }

  function nightsBetween(from: Date, to: Date): number {
    return Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
  }

  // Today's IST-midnight, used to derive "Night X of Y" for in-house guests.
  const todayMidnight = dayStart;

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
        const totalNights = reservation ? nightsBetween(reservation.checkIn, reservation.checkOut) : null;
        const nightNumber = reservation && checkedIn
          ? Math.min(totalNights ?? 1, Math.max(1, nightsBetween(reservation.checkIn, todayMidnight) + 1))
          : null;
        // For DIRTY rooms without an active reservation, attach the last
        // departed guest so the UI can render "Last: …" context.
        const lastDeparture =
          room.state === 'DIRTY' && !reservation ? lastDepartureByRoom.get(room.id) : undefined;
        // For rooms without an active/today reservation, attach the next
        // future arrival so vacant_clean (and dirty) rooms can render
        // "Next Arrival: …".
        const nextArrival = !reservation ? nextArrivalByRoom.get(room.id) : undefined;
        return {
          roomId: room.id,
          roomNumber: room.number,
          state: room.state,
          stateVersion: room.stateVersion,
          guestName: reservation ? (guestMap.get(reservation.guestId) ?? null) : null,
          reservationId: reservation?.id ?? null,
          bookingReference: reservation?.bookingReference ?? null,
          checkIn: reservation?.checkIn ?? null,
          checkOut: reservation?.checkOut ?? null,
          nightNumber,
          totalNights,
          visualState: deriveVisualState(room, { arrivingToday, departingToday, checkedIn }),
          lastGuestName: lastDeparture ? (guestMap.get(lastDeparture.guestId) ?? null) : null,
          lastCheckOut: lastDeparture?.checkOut ?? null,
          nextArrivalGuestName: nextArrival ? (guestMap.get(nextArrival.guestId) ?? null) : null,
          nextArrivalCheckIn: nextArrival?.checkIn ?? null,
          nextArrivalBookingReference: nextArrival?.bookingReference ?? null,
        };
      }),
    };
  });

  return NextResponse.json({ groups });
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
