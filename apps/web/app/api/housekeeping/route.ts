// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { startOfIstDayUtc, endOfIstDayUtc, todayIST } from '@/lib/tz';

const ATTENTION_STATES = ['DIRTY', 'CLEAN', 'OUT_OF_ORDER', 'MAINTENANCE', 'AVAILABLE', 'OCCUPIED', 'HELD'];

export const GET = withAuth(async (_req, actor) => {
  const today = todayIST();
  const dayStart = startOfIstDayUtc(today);
  const dayEnd = endOfIstDayUtc(today);

  const [rooms, roomTypes, todaysReservations, blocks] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, state: { in: ATTENTION_STATES } },
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
      include: { },
    }),
    prisma.roomBlock.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, endDate: { gte: dayStart } },
    }),
  ]);

  const guestIds = Array.from(new Set(todaysReservations.map((r) => r.guestId)));
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { id: true, fullName: true },
  });
  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));
  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt.name]));

  const reservationsByRoom = new Map<string, typeof todaysReservations>();
  for (const r of todaysReservations) {
    const arr = reservationsByRoom.get(r.roomId) ?? [];
    arr.push(r);
    reservationsByRoom.set(r.roomId, arr);
  }
  const blockByRoom = new Map(blocks.map((b) => [b.roomId, b]));

  const rows = rooms.map((room) => {
    const roomReservations = reservationsByRoom.get(room.id) ?? [];
    const departing = roomReservations.find(
      (r) => r.status === 'CHECKED_OUT' || (r.status === 'CHECKED_IN' && r.checkOut <= dayEnd),
    );
    const arriving = roomReservations.find(
      (r) => r.status === 'CONFIRMED' && r.checkIn >= dayStart && r.checkIn <= dayEnd,
    );
    const inHouse = roomReservations.find((r) => r.status === 'CHECKED_IN' && r.checkOut > dayEnd);

    let priority: 'high' | 'med' | 'low' = 'low';
    if (room.state === 'DIRTY' && arriving) priority = 'high';
    else if (room.state === 'DIRTY') priority = 'med';

    let reason = '';
    if (departing && arriving) {
      reason = `Checked out: ${guestMap.get(departing.guestId) ?? ''} · ${guestMap.get(arriving.guestId) ?? ''} arriving today`;
    } else if (departing) {
      reason = `Checked out: ${guestMap.get(departing.guestId) ?? ''}`;
    } else if (inHouse) {
      reason = `In-house: ${guestMap.get(inHouse.guestId) ?? ''}`;
    } else if (arriving) {
      reason = `${guestMap.get(arriving.guestId) ?? ''} arriving today`;
    }

    const block = blockByRoom.get(room.id);
    if (block) {
      reason = `${block.reason} · Reported ${block.startDate.toISOString().slice(0, 10)}`;
    }

    return {
      roomId: room.id,
      roomNumber: room.number,
      roomTypeName: roomTypeMap.get(room.roomTypeId) ?? 'Room',
      state: room.state,
      stateVersion: room.stateVersion,
      priority,
      reason,
      blockId: block?.id ?? null,
      blockType: block?.blockType ?? null,
      blockEndDate: block?.endDate ?? null,
      lastUpdatedAt: room.updatedAt,
    };
  });

  const counts = {
    total: rows.length,
    needsCleaning: rows.filter((r) => r.state === 'DIRTY').length,
    inProgress: 0,
    cleanReady: rows.filter((r) => r.state === 'CLEAN' || r.state === 'AVAILABLE').length,
    outOfOrder: rows.filter((r) => r.state === 'OUT_OF_ORDER' || r.state === 'MAINTENANCE').length,
  };

  return NextResponse.json({ rooms: rows, counts });
}, ['OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING']);
