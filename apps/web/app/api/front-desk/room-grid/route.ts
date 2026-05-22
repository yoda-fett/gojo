// @ts-nocheck
import { deriveRoomStatus, prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { startOfIstDayUtc, endOfIstDayUtc, todayIST } from '@/lib/tz';

// Epic 15: every tile is composed by the shared `deriveRoomStatus` helper —
// the route loads the inputs (reservations, blocks, hold) and the helper
// resolves occupancy, housekeeping, out-of-service, and the display token.

export const GET = withAuth(async (_req, actor) => {
  const today = todayIST();
  const dayStart = startOfIstDayUtc(today);
  const dayEnd = endOfIstDayUtc(today);
  const now = new Date();

  const [rooms, roomTypes, activeReservations, recentDepartures, futureArrivals, blocks] =
    await Promise.all([
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
      // CHECKED_OUT in the last 30 days — enough to surface the last guest on a
      // dirty room; older than that and the room would have been cleaned.
      prisma.reservation.findMany({
        where: {
          propertyId: actor.propertyId,
          deletedAt: null,
          status: 'CHECKED_OUT',
          checkOut: { gte: new Date(dayStart.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { checkOut: 'desc' },
      }),
      // Future CONFIRMED arrivals (beyond today) so vacant rooms surface their
      // next guest.
      prisma.reservation.findMany({
        where: {
          propertyId: actor.propertyId,
          deletedAt: null,
          status: 'CONFIRMED',
          checkIn: { gt: dayEnd },
        },
        orderBy: { checkIn: 'asc' },
      }),
      prisma.roomBlock.findMany({
        where: {
          propertyId: actor.propertyId,
          deletedAt: null,
          OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
        },
      }),
    ]);

  const allReservations = [...activeReservations, ...recentDepartures, ...futureArrivals];
  const guestIds = Array.from(new Set(allReservations.map((r) => r.guestId)));
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { id: true, fullName: true },
  });
  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));

  const reservationsByRoom = new Map<string, ReturnType<typeof toReservationInput>[]>();
  function toReservationInput(r: (typeof allReservations)[number]) {
    return {
      id: r.id,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      guestName: guestMap.get(r.guestId) ?? null,
      bookingReference: r.bookingReference ?? null,
    };
  }
  for (const r of allReservations) {
    const arr = reservationsByRoom.get(r.roomId) ?? [];
    arr.push(toReservationInput(r));
    reservationsByRoom.set(r.roomId, arr);
  }

  const blocksByRoom = new Map<string, (typeof blocks)[number][]>();
  for (const b of blocks) {
    const arr = blocksByRoom.get(b.roomId) ?? [];
    arr.push(b);
    blocksByRoom.set(b.roomId, arr);
  }

  const groups = roomTypes.map((rt) => {
    const inType = rooms.filter((room) => room.roomTypeId === rt.id);
    return {
      roomTypeId: rt.id,
      roomTypeName: rt.name,
      rooms: inType.map((room) => {
        const roomReservations = reservationsByRoom.get(room.id) ?? [];
        const status = deriveRoomStatus(
          { housekeepingStatus: room.housekeepingStatus, holdExpiresAt: room.holdExpiresAt },
          roomReservations,
          blocksByRoom.get(room.id) ?? [],
          now,
        );
        const tl = status.timeline;
        // Primary guest = the in-house guest, else today's arrival.
        const primary = tl.currentReservation ?? (tl.arrivingToday ? tl.nextArrival : null);
        return {
          roomId: room.id,
          roomNumber: room.number,
          stateVersion: room.stateVersion,
          // Composed status (solution model §3).
          display: status.display,
          housekeeping: status.housekeeping,
          occupancy: status.occupancy,
          held: status.held,
          reserved: status.reserved,
          outOfService: status.outOfService,
          // Timeline / guest context.
          guestName: primary?.guestName ?? null,
          reservationId: primary?.id ?? null,
          bookingReference: primary?.bookingReference ?? null,
          checkIn: primary?.checkIn ?? null,
          checkOut: primary?.checkOut ?? null,
          nightNumber: tl.nightNumber,
          totalNights: tl.totalNights,
          lastGuestName: tl.lastGuest?.guestName ?? null,
          lastCheckOut: tl.lastGuest?.checkOut ?? null,
          nextArrivalGuestName: tl.nextArrival?.guestName ?? null,
          nextArrivalCheckIn: tl.nextArrival?.checkIn ?? null,
          nextArrivalBookingReference: tl.nextArrival?.bookingReference ?? null,
        };
      }),
    };
  });

  return NextResponse.json({ groups });
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
