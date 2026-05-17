import { prisma } from '@gojo/db';

import type { DateRange } from '@/lib/dashboard/date-range';
import { toUtcRange } from '@/lib/dashboard/date-range';

type Amenity = {
  id: string;
  roomTypeId: string | null;
  name: string;
  unit: string;
  expectedQtyPerStay: number | null;
};

export type ConsumptionReportRow = {
  catalogItemId: string;
  name: string;
  unit: string;
  totalUsed: number;
  expectedTotal: number;
  variance: number;
};

export async function getConsumptionReport(propertyId: string, range: DateRange) {
  const utc = toUtcRange(range);
  const [amenities, logs, rooms, reservations] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { propertyId, itemType: 'AMENITY', deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, roomTypeId: true, name: true, unit: true, expectedQtyPerStay: true },
    }) as Promise<Amenity[]>,
    prisma.consumptionLog.findMany({
      where: { propertyId, createdAt: { gte: utc.from, lte: utc.to } },
      select: { roomId: true, catalogItemId: true, qtyUsed: true },
    }),
    prisma.room.findMany({ where: { propertyId, deletedAt: null }, select: { id: true, number: true, roomTypeId: true } }),
    prisma.reservation.findMany({
      where: { propertyId, deletedAt: null, status: 'CHECKED_OUT', checkOut: { gte: utc.from, lte: utc.to } },
      select: { roomId: true, roomTypeId: true },
    }),
  ]);

  const amenityIds = new Set(amenities.map((item) => item.id));
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const staysByRoomType = new Map<string, number>();
  const staysByRoom = new Map<string, number>();
  for (const reservation of reservations) {
    staysByRoomType.set(reservation.roomTypeId, (staysByRoomType.get(reservation.roomTypeId) ?? 0) + 1);
    staysByRoom.set(reservation.roomId, (staysByRoom.get(reservation.roomId) ?? 0) + 1);
  }

  const usedByItem = new Map<string, number>();
  const usedByRoomItem = new Map<string, number>();
  for (const log of logs) {
    if (!amenityIds.has(log.catalogItemId)) continue;
    usedByItem.set(log.catalogItemId, (usedByItem.get(log.catalogItemId) ?? 0) + log.qtyUsed);
    usedByRoomItem.set(`${log.roomId}:${log.catalogItemId}`, (usedByRoomItem.get(`${log.roomId}:${log.catalogItemId}`) ?? 0) + log.qtyUsed);
  }

  const summary = amenities.map((item) => {
    const expectedTotal = (item.expectedQtyPerStay ?? 0) * (item.roomTypeId ? staysByRoomType.get(item.roomTypeId) ?? 0 : 0);
    const totalUsed = usedByItem.get(item.id) ?? 0;
    return {
      catalogItemId: item.id,
      name: item.name,
      unit: item.unit,
      totalUsed,
      expectedTotal,
      variance: totalUsed - expectedTotal,
    };
  });

  const byRoom = rooms.map((room) => {
    const roomAmenities = amenities.filter((item) => item.roomTypeId === room.roomTypeId);
    const stays = staysByRoom.get(room.id) ?? 0;
    return {
      roomId: room.id,
      roomNumber: room.number,
      roomTypeId: room.roomTypeId,
      stays,
      items: roomAmenities.map((item) => {
        const totalUsed = usedByRoomItem.get(`${room.id}:${item.id}`) ?? 0;
        const expectedTotal = (item.expectedQtyPerStay ?? 0) * stays;
        return {
          catalogItemId: item.id,
          name: item.name,
          unit: item.unit,
          totalUsed,
          expectedTotal,
          variance: totalUsed - expectedTotal,
        };
      }),
    };
  });

  return {
    period: range,
    expectedBasis: 'Checked-out stays in the selected date range multiplied by each amenity room-type par.',
    summary,
    byRoom,
    totals: {
      totalUsed: summary.reduce((sum, row) => sum + row.totalUsed, 0),
      expectedTotal: summary.reduce((sum, row) => sum + row.expectedTotal, 0),
      variance: summary.reduce((sum, row) => sum + row.variance, 0),
    },
  };
}

export function consumptionReportCsv(data: Awaited<ReturnType<typeof getConsumptionReport>>) {
  const rows: Array<Array<string | number>> = [
    ['item', 'unit', 'totalUsed', 'expectedTotal', 'variance', 'roomNumber', 'roomTotalUsed', 'roomExpectedTotal', 'roomVariance'],
  ];
  for (const row of data.summary) {
    const roomRows = data.byRoom.flatMap((room) =>
      room.items.filter((item) => item.catalogItemId === row.catalogItemId).map((item) => ({ room, item })),
    );
    if (roomRows.length === 0) rows.push([row.name, row.unit, row.totalUsed, row.expectedTotal, row.variance, '', '', '', '']);
    for (const entry of roomRows) {
      rows.push([
        row.name,
        row.unit,
        row.totalUsed,
        row.expectedTotal,
        row.variance,
        entry.room.roomNumber,
        entry.item.totalUsed,
        entry.item.expectedTotal,
        entry.item.variance,
      ]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
