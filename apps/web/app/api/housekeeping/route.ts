// @ts-nocheck
import { deriveRoomStatus, prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { startOfIstDayUtc, endOfIstDayUtc, todayIST } from '@/lib/tz';

// Epic 15: the Rooms-Needing-Attention view renders composed status. A room
// needs attention when its housekeeping axis is DIRTY or it is out of service;
// occupancy / arrival context drives the cleaning priority.

export const GET = withAuth(async (_req, actor) => {
  const today = todayIST();
  const dayStart = startOfIstDayUtc(today);
  const dayEnd = endOfIstDayUtc(today);
  const now = new Date();

  const [rooms, roomTypes, todaysReservations, blocks] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      orderBy: { number: 'asc' },
    }),
    prisma.roomType.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.reservation.findMany({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        OR: [
          { checkOut: { gte: dayStart, lte: dayEnd }, status: { in: ['CHECKED_IN', 'CHECKED_OUT'] } },
          { checkIn: { gte: dayStart, lte: dayEnd }, status: 'CONFIRMED' },
          { status: 'CHECKED_IN', checkIn: { lt: dayStart }, checkOut: { gt: dayEnd } },
        ],
      },
    }),
    prisma.roomBlock.findMany({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
      },
    }),
  ]);

  const guestIds = Array.from(new Set(todaysReservations.map((r) => r.guestId)));
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { id: true, fullName: true },
  });
  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));
  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  const reservationsByRoom = new Map<string, any[]>();
  for (const r of todaysReservations) {
    const arr = reservationsByRoom.get(r.roomId) ?? [];
    arr.push({
      id: r.id,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      guestName: guestMap.get(r.guestId) ?? null,
      bookingReference: r.bookingReference ?? null,
    });
    reservationsByRoom.set(r.roomId, arr);
  }
  const blocksByRoom = new Map<string, (typeof blocks)[number][]>();
  for (const b of blocks) {
    const arr = blocksByRoom.get(b.roomId) ?? [];
    arr.push(b);
    blocksByRoom.set(b.roomId, arr);
  }

  const rows = rooms.map((room) => {
    const roomReservations = reservationsByRoom.get(room.id) ?? [];
    const status = deriveRoomStatus(
      { housekeepingStatus: room.housekeepingStatus, holdExpiresAt: room.holdExpiresAt },
      roomReservations,
      blocksByRoom.get(room.id) ?? [],
      now,
    );

    let priority: 'high' | 'med' | 'low' = 'low';
    if (status.housekeeping === 'DIRTY' && status.timeline.arrivingToday) priority = 'high';
    else if (status.housekeeping === 'DIRTY') priority = 'med';

    const departing = roomReservations.find(
      (r) => r.status === 'CHECKED_OUT' || (r.status === 'CHECKED_IN' && r.checkOut <= dayEnd),
    );
    const arriving = roomReservations.find(
      (r) => r.status === 'CONFIRMED' && r.checkIn >= dayStart && r.checkIn <= dayEnd,
    );
    const inHouse = roomReservations.find((r) => r.status === 'CHECKED_IN' && r.checkOut > dayEnd);

    let reason = '';
    if (departing && arriving) {
      reason = `Checked out: ${departing.guestName ?? ''} · ${arriving.guestName ?? ''} arriving today`;
    } else if (departing) {
      reason = `Checked out: ${departing.guestName ?? ''}`;
    } else if (inHouse) {
      reason = `In-house: ${inHouse.guestName ?? ''}`;
    } else if (arriving) {
      reason = `${arriving.guestName ?? ''} arriving today`;
    }
    if (status.outOfService) {
      reason = `${status.outOfService.reason} · Reported ${status.outOfService.from
        .toISOString()
        .slice(0, 10)}`;
    }

    return {
      roomId: room.id,
      roomNumber: room.number,
      roomTypeName: roomTypeMap.get(room.roomTypeId) ?? 'Room',
      display: status.display,
      housekeeping: status.housekeeping,
      occupancy: status.occupancy,
      stateVersion: room.stateVersion,
      priority,
      reason,
      outOfService: status.outOfService,
      lastUpdatedAt: room.updatedAt,
    };
  });

  const counts = {
    total: rows.length,
    needsCleaning: rows.filter((r) => r.housekeeping === 'DIRTY').length,
    inProgress: 0,
    cleanReady: rows.filter((r) => r.housekeeping === 'CLEAN' && !r.outOfService).length,
    outOfOrder: rows.filter((r) => r.outOfService != null).length,
  };

  return NextResponse.json({ rooms: rows, counts });
}, ['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING']);
