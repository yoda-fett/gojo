// @ts-nocheck
import { prisma } from '@gojo/db';

import { RESERVATION_SOURCES, type Role } from '@gojo/types';

import type { DateRange } from '@/lib/dashboard/date-range';
import { listDateKeys, priorRange, toUtcRange } from '@/lib/dashboard/date-range';
import { formatISTDateKey, startOfIstDayUtc, todayIST } from '@/lib/tz';


type RoomRecord = {
  id: string;
  roomTypeId: string;
  number: string;
  state: string;
  updatedAt: Date;
};

type RoomTypeRecord = {
  id: string;
  name: string;
};

type GuestRecord = {
  id: string;
  fullName: string;
};

type ReservationRecord = {
  id: string;
  guestId: string;
  roomId: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  source: string;
};

type FolioRecord = {
  id: string;
  reservationId: string;
};

type FolioLineRecord = {
  folioId: string;
  amount: unknown;
  chargeType: string;
  postedAt: Date;
};

type AlertRecord = {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  entityId?: string | null;
  createdAt: Date;
  status: string;
};

function numberize(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function nextIstDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00+05:30`);
  date.setUTCDate(date.getUTCDate() + 1);
  return formatISTDateKey(date);
}

function diffDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function getNightWindow(checkIn: Date, checkOut: Date) {
  const start = startOfIstDayUtc(checkIn);
  const rawEnd = startOfIstDayUtc(checkOut);
  const end = rawEnd > start ? rawEnd : startOfIstDayUtc(nextIstDateKey(formatISTDateKey(checkIn)));

  return { start, end };
}

function overlapsNight(checkIn: Date, checkOut: Date, rangeStart: Date, rangeEndExclusive: Date) {
  const stay = getNightWindow(checkIn, checkOut);
  return stay.start < rangeEndExclusive && stay.end > rangeStart;
}

function inRange(value: Date, start: Date, end: Date) {
  return value >= start && value <= end;
}

function roomNightsInRange(reservation: Pick<ReservationRecord, 'checkIn' | 'checkOut'>, range: DateRange) {
  const stay = getNightWindow(new Date(reservation.checkIn), new Date(reservation.checkOut));
  const rangeStart = startOfIstDayUtc(range.from);
  const rangeEnd = startOfIstDayUtc(nextIstDateKey(range.to));
  const overlapStart = stay.start > rangeStart ? stay.start : rangeStart;
  const overlapEnd = stay.end < rangeEnd ? stay.end : rangeEnd;

  return overlapEnd > overlapStart ? diffDays(overlapStart, overlapEnd) : 0;
}

async function loadCore(propertyId: string, range: DateRange): Promise<{
  rooms: RoomRecord[];
  roomTypes: RoomTypeRecord[];
  guests: GuestRecord[];
  reservations: ReservationRecord[];
  folios: FolioRecord[];
  folioLines: FolioLineRecord[];
  alerts: AlertRecord[];
}> {
  const utc = toUtcRange(range);
  const expandedStart = new Date(utc.from.getTime() - 95 * 24 * 60 * 60 * 1000);
  const [rooms, roomTypes, guests, reservations, folios, folioLines, alerts] = await Promise.all([
    prisma.room.findMany({ where: { propertyId, deletedAt: null }, orderBy: { number: 'asc' } }),
    prisma.roomType.findMany({ where: { propertyId, deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.guest.findMany({ where: { propertyId, deletedAt: null } }),
    prisma.reservation.findMany({ where: { propertyId, deletedAt: null, checkOut: { gte: expandedStart } }, orderBy: { checkIn: 'asc' } }),
    prisma.folio.findMany({ where: { propertyId, deletedAt: null } }),
    prisma.folioLine.findMany({ where: { propertyId, postedAt: { gte: expandedStart } }, orderBy: { postedAt: 'asc' } }),
    prisma.alert.findMany({ where: { propertyId }, orderBy: { createdAt: 'desc' } }),
  ]);

  return {
    rooms: rooms as RoomRecord[],
    roomTypes: roomTypes as RoomTypeRecord[],
    guests: guests as GuestRecord[],
    reservations: reservations as ReservationRecord[],
    folios: folios as FolioRecord[],
    folioLines: folioLines as FolioLineRecord[],
    alerts: alerts as AlertRecord[],
  };
}

function revenueForReservation(reservationId: string, folios: { id: string; reservationId: string }[], lines: { folioId: string; amount: unknown; chargeType: string; postedAt: Date }[], start: Date, end: Date) {
  const folioIds = folios.filter((folio) => folio.reservationId === reservationId).map((folio) => folio.id);
  return lines
    .filter((line) => folioIds.includes(line.folioId) && inRange(new Date(line.postedAt), start, end))
    .reduce((sum, line) => sum + numberize(line.amount), 0);
}

function buildDailySeries(range: DateRange, rooms: { id: string }[], reservations: { roomId: string; checkIn: Date; checkOut: Date; status: string; source: string; id: string }[], folios: { id: string; reservationId: string }[], lines: { folioId: string; amount: unknown; chargeType: string; postedAt: Date }[]) {
  return listDateKeys(range).map((dateKey) => {
    const start = new Date(`${dateKey}T00:00:00+05:30`);
    const endExclusive = startOfIstDayUtc(nextIstDateKey(dateKey));
    const occupiedReservations = reservations.filter((reservation) => reservation.status !== 'CANCELLED' && reservation.status !== 'NO_SHOW' && overlapsNight(new Date(reservation.checkIn), new Date(reservation.checkOut), start, endExclusive));
    const roomsOccupied = unique(occupiedReservations.map((reservation) => reservation.roomId)).length;
    const occupancyRate = rooms.length ? (roomsOccupied / rooms.length) * 100 : 0;
    const revenue = occupiedReservations.reduce(
      (sum, reservation) => sum + revenueForReservation(reservation.id, folios, lines, start, new Date(endExclusive.getTime() - 1)),
      0,
    );

    return {
      date: dateKey,
      occupancyRate: Number(occupancyRate.toFixed(1)),
      revenue: Number(revenue.toFixed(2)),
      roomsOccupied,
    };
  });
}

function trend(current: number, previous: number) {
  if (previous === 0) {
    return { direction: current > 0 ? 'up' : 'flat', pct: current > 0 ? 100 : 0 } as const;
  }
  const pct = ((current - previous) / previous) * 100;
  return { direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', pct: Number(pct.toFixed(1)) } as const;
}

export async function getDashboardSnapshot(propertyId: string, role: Role, range: DateRange) {
  const { rooms, roomTypes, guests, reservations, folios, folioLines, alerts } = await loadCore(propertyId, range);
  const utc = toUtcRange(range);
  const utcEndExclusive = startOfIstDayUtc(nextIstDateKey(range.to));
  const prior = priorRange(range);
  const priorUtc = toUtcRange(prior);
  const priorUtcEndExclusive = startOfIstDayUtc(nextIstDateKey(prior.to));
  const roomTypeMap = Object.fromEntries(roomTypes.map((roomType) => [roomType.id, roomType]));
  const guestMap = Object.fromEntries(guests.map((guest) => [guest.id, guest]));

  const currentSeries = buildDailySeries(range, rooms, reservations, folios, folioLines);
  const arrivalsToday = reservations.filter((reservation) => inRange(new Date(reservation.checkIn), utc.from, utc.to) && ['CONFIRMED', 'CHECKED_IN', 'ARRIVING_TODAY'].includes(reservation.status));
  const departuresToday = reservations.filter((reservation) => inRange(new Date(reservation.checkOut), utc.from, utc.to));
  const occupiedReservations = reservations.filter((reservation) => ['CHECKED_IN', 'CONFIRMED'].includes(reservation.status) && overlapsNight(new Date(reservation.checkIn), new Date(reservation.checkOut), utc.from, utcEndExclusive));
  const roomsOccupied = unique(occupiedReservations.map((reservation) => reservation.roomId)).length;
  const occupancyRate = rooms.length ? Number(((roomsOccupied / rooms.length) * 100).toFixed(1)) : 0;
  const revenueToday = Number(
    folioLines
      .filter((line) => inRange(new Date(line.postedAt), utc.from, utc.to))
      .reduce((sum, line) => sum + numberize(line.amount), 0)
      .toFixed(2),
  );

  const previousArrivals = reservations.filter((reservation) => inRange(new Date(reservation.checkIn), priorUtc.from, priorUtc.to) && ['CONFIRMED', 'CHECKED_IN', 'ARRIVING_TODAY'].includes(reservation.status)).length;
  const previousDepartures = reservations.filter((reservation) => inRange(new Date(reservation.checkOut), priorUtc.from, priorUtc.to)).length;
  const previousOccupied = unique(
    reservations
      .filter((reservation) => ['CHECKED_IN', 'CONFIRMED'].includes(reservation.status) && overlapsNight(new Date(reservation.checkIn), new Date(reservation.checkOut), priorUtc.from, priorUtcEndExclusive))
      .map((reservation) => reservation.roomId),
  ).length;
  const previousOccupancy = rooms.length ? (previousOccupied / rooms.length) * 100 : 0;
  const previousRevenue = folioLines
    .filter((line) => inRange(new Date(line.postedAt), priorUtc.from, priorUtc.to))
    .reduce((sum, line) => sum + numberize(line.amount), 0);

  const arrivals = arrivalsToday.slice(0, 5).map((reservation) => ({
    bookingRef: reservation.id.toUpperCase().slice(-8),
    guestName: guestMap[reservation.guestId]?.fullName ?? 'Guest',
    roomType: roomTypeMap[reservation.roomTypeId]?.name ?? 'Room',
    checkInTime: reservation.checkIn.toISOString(),
    status: reservation.status,
  }));

  return {
    kpis: {
      occupancyRate,
      revenueToday: role === 'FRONT_DESK' ? undefined : revenueToday,
      arrivalsToday: arrivalsToday.length,
      departuresToday: departuresToday.length,
      sparklines: {
        occupancyRate: currentSeries.slice(-7).map((entry) => entry.occupancyRate),
        revenueToday: currentSeries.slice(-7).map((entry) => entry.revenue),
        arrivalsToday: currentSeries.slice(-7).map((entry) => entry.roomsOccupied),
        departuresToday: currentSeries.slice(-7).map((entry) => entry.roomsOccupied),
      },
      trends: {
        occupancyRate: trend(occupancyRate, previousOccupancy),
        revenueToday: trend(revenueToday, previousRevenue),
        arrivalsToday: trend(arrivalsToday.length, previousArrivals),
        departuresToday: trend(departuresToday.length, previousDepartures),
      },
    },
    arrivals,
    chart: currentSeries,
    alerts,
    roomsNeedingAttention: rooms
      .filter((room) => !['AVAILABLE', 'CLEAN'].includes(room.state))
      .map((room) => ({
        roomId: room.id,
        roomNumber: room.number,
        roomType: roomTypeMap[room.roomTypeId]?.name ?? 'Room',
        housekeepingState: room.state,
        flaggedAt: room.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      })),
  };
}

export async function getOccupancyReport(propertyId: string, range: DateRange) {
  const { rooms, roomTypes, reservations, folios, folioLines } = await loadCore(propertyId, range);
  const currentSeries = buildDailySeries(range, rooms, reservations, folios, folioLines);
  const previous = priorRange(range);
  const previousSeries = buildDailySeries(previous, rooms, reservations, folios, folioLines);
  const currentKeys = new Set(listDateKeys(range));
  const roomCountByType = roomTypes.map((roomType) => ({ roomTypeId: roomType.id, roomType: roomType.name, roomCount: rooms.filter((room) => room.roomTypeId === roomType.id).length }));
  const soldReservations = reservations.filter((reservation) => ['CHECKED_IN', 'CHECKED_OUT', 'CONFIRMED'].includes(reservation.status));
  const totalRoomNights = soldReservations.reduce((sum, reservation) => sum + roomNightsInRange(reservation, range), 0);
  const roomRevenue = folioLines.filter((line) => line.chargeType === 'ROOM' && currentKeys.has(formatISTDateKey(line.postedAt))).reduce((sum, line) => sum + numberize(line.amount), 0);
  const avgOccupancyPct = currentSeries.length ? currentSeries.reduce((sum, item) => sum + item.occupancyRate, 0) / currentSeries.length : 0;
  const adr = totalRoomNights ? roomRevenue / totalRoomNights : 0;
  const revpar = rooms.length && currentSeries.length ? roomRevenue / (rooms.length * currentSeries.length) : 0;
  const previousRoomRevenue = folioLines
    .filter((line) => line.chargeType === 'ROOM' && previousSeries.some((series) => formatISTDateKey(line.postedAt) === series.date))
    .reduce((sum, line) => sum + numberize(line.amount), 0);
  const previousAvgOcc = previousSeries.length ? previousSeries.reduce((sum, item) => sum + item.occupancyRate, 0) / previousSeries.length : 0;
  const previousRoomNights = previousSeries.reduce((sum, item) => sum + item.roomsOccupied, 0);
  const previousAdr = previousRoomNights ? previousRoomRevenue / previousRoomNights : 0;
  const previousRevpar = rooms.length && previousSeries.length ? previousRoomRevenue / (rooms.length * previousSeries.length) : 0;

  const byRoomType = roomCountByType.map((entry) => {
    const roomTypeReservations = soldReservations.filter((reservation) => reservation.roomTypeId === entry.roomTypeId);
    const nightsSold = roomTypeReservations.reduce((sum, reservation) => sum + roomNightsInRange(reservation, range), 0);
    const availableNights = entry.roomCount * Math.max(currentSeries.length, 1);
    const revenue = roomTypeReservations.reduce((sum, reservation) => sum + revenueForReservation(reservation.id, folios, folioLines, new Date(`${range.from}T00:00:00+05:30`), new Date(`${range.to}T23:59:59.999+05:30`)), 0);
    return {
      roomType: entry.roomType,
      roomCount: entry.roomCount,
      nightsSold,
      availableNights,
      adr: nightsSold ? revenue / nightsSold : 0,
      occupancyPct: availableNights ? (nightsSold / availableNights) * 100 : 0,
      revenue,
    };
  }).sort((left, right) => right.occupancyPct - left.occupancyPct);

  const weekdayBuckets = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((weekday, index) => {
    const values = currentSeries.filter((entry) => new Date(`${entry.date}T00:00:00+05:30`).getUTCDay() === ((index + 1) % 7)).map((entry) => entry.occupancyRate);
    return { weekday, avgOccupancyPct: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 };
  });

  const bySourceRaw = RESERVATION_SOURCES.map((source) => {
    const sourceReservations = soldReservations.filter((reservation) => reservation.source === source);
    const roomNights = sourceReservations.reduce((sum, reservation) => sum + roomNightsInRange(reservation, range), 0);
    return { source, roomNights, sharePct: totalRoomNights ? (roomNights / totalRoomNights) * 100 : 0 };
  });

  return {
    period: range,
    kpis: {
      avgOccupancyPct: Number(avgOccupancyPct.toFixed(1)),
      adr: Number(adr.toFixed(2)),
      revpar: Number(revpar.toFixed(2)),
      totalRoomNights,
      vsprior: {
        avgOccupancyPct: Number((avgOccupancyPct - previousAvgOcc).toFixed(1)),
        adr: Number((((adr - previousAdr) / (previousAdr || 1)) * 100).toFixed(1)),
        revpar: Number((((revpar - previousRevpar) / (previousRevpar || 1)) * 100).toFixed(1)),
        totalRoomNights: Number((((totalRoomNights - previousRoomNights) / (previousRoomNights || 1)) * 100).toFixed(1)),
      },
    },
    dailySeries: currentSeries,
    byRoomType,
    byWeekday: weekdayBuckets,
    byDay: currentSeries.map((entry) => ({ date: entry.date, occupancyPct: entry.occupancyRate })),
    bySource: bySourceRaw,
  };
}

export async function getRevenueReport(propertyId: string, range: DateRange) {
  const occupancy = await getOccupancyReport(propertyId, range);
  const { roomTypes, reservations, folios, folioLines, rooms } = await loadCore(propertyId, range);
  const currentKeys = new Set(listDateKeys(range));
  const soldReservations = reservations.filter((reservation) => ['CHECKED_IN', 'CHECKED_OUT', 'CONFIRMED'].includes(reservation.status));
  const periodLines = folioLines.filter((line) => currentKeys.has(formatISTDateKey(line.postedAt)));
  const totalRevenue = periodLines.reduce((sum, line) => sum + numberize(line.amount), 0);
  const roomRevenue = periodLines.filter((line) => line.chargeType === 'ROOM').reduce((sum, line) => sum + numberize(line.amount), 0);
  const fbRevenue = periodLines.filter((line) => ['FB', 'FNB'].includes(line.chargeType)).reduce((sum, line) => sum + numberize(line.amount), 0);
  const miscRevenue = totalRevenue - roomRevenue - fbRevenue;
  const totalRoomNights = occupancy.kpis.totalRoomNights;
  const adr = totalRoomNights ? roomRevenue / totalRoomNights : 0;
  const revpar = rooms.length && occupancy.dailySeries.length ? roomRevenue / (rooms.length * occupancy.dailySeries.length) : 0;
  const previousRangeData = priorRange(range);
  const previous = await getOccupancyReport(propertyId, previousRangeData);
  const previousKeys = new Set(listDateKeys(previousRangeData));
  const previousLines = folioLines.filter((line) => previousKeys.has(formatISTDateKey(line.postedAt)));
  const previousTotalRevenue = previousLines.reduce((sum, line) => sum + numberize(line.amount), 0);
  const previousRoomRevenue = previousLines.filter((line) => line.chargeType === 'ROOM').reduce((sum, line) => sum + numberize(line.amount), 0);
  const previousFbRevenue = previousLines.filter((line) => ['FB', 'FNB'].includes(line.chargeType)).reduce((sum, line) => sum + numberize(line.amount), 0);
  const previousMisc = previousTotalRevenue - previousRoomRevenue - previousFbRevenue;
  const priorDateKeys = listDateKeys(previousRangeData);
  const currentDateKeys = listDateKeys(range);

  const dailySeries = currentDateKeys.map((date, index) => ({
    date,
    roomRevenue: periodLines.filter((line) => formatISTDateKey(line.postedAt) === date && line.chargeType === 'ROOM').reduce((sum, line) => sum + numberize(line.amount), 0),
    fbRevenue: periodLines.filter((line) => formatISTDateKey(line.postedAt) === date && ['FB', 'FNB'].includes(line.chargeType)).reduce((sum, line) => sum + numberize(line.amount), 0),
    priorRevenue: previousLines.filter((line) => formatISTDateKey(line.postedAt) === priorDateKeys[index]).reduce((sum, line) => sum + numberize(line.amount), 0),
  }));

  const byCategory = [
    { category: 'ROOM', amount: roomRevenue, priorAmount: previousRoomRevenue, transactions: periodLines.filter((line) => line.chargeType === 'ROOM').length, vsPriorPct: previousRoomRevenue === 0 ? null : ((roomRevenue - previousRoomRevenue) / previousRoomRevenue) * 100 },
    { category: 'FB', amount: fbRevenue, priorAmount: previousFbRevenue, transactions: periodLines.filter((line) => ['FB', 'FNB'].includes(line.chargeType)).length, vsPriorPct: previousFbRevenue === 0 ? null : ((fbRevenue - previousFbRevenue) / previousFbRevenue) * 100 },
    { category: 'MISC', amount: miscRevenue, priorAmount: previousMisc, transactions: periodLines.filter((line) => !['ROOM', 'FB', 'FNB'].includes(line.chargeType)).length, vsPriorPct: previousMisc === 0 ? null : ((miscRevenue - previousMisc) / previousMisc) * 100 },
  ].map((entry) => ({ ...entry, sharePct: totalRevenue ? (entry.amount / totalRevenue) * 100 : 0 }));

  const byRoomType = roomTypes.map((roomType) => {
    const sourceReservations = soldReservations.filter((reservation) => reservation.roomTypeId === roomType.id);
    const nightsSold = sourceReservations.reduce((sum, reservation) => sum + roomNightsInRange(reservation, range), 0);
    const revenue = sourceReservations.reduce((sum, reservation) => sum + revenueForReservation(reservation.id, folios, folioLines, new Date(`${range.from}T00:00:00+05:30`), new Date(`${range.to}T23:59:59.999+05:30`)), 0);
    return {
      roomType: roomType.name,
      roomCount: rooms.filter((room) => room.roomTypeId === roomType.id).length,
      nightsSold,
      adr: nightsSold ? revenue / nightsSold : 0,
      occupancyPct: occupancy.byRoomType.find((entry) => entry.roomType === roomType.name)?.occupancyPct ?? 0,
      revenue,
    };
  });

  const bySource = RESERVATION_SOURCES.map((source) => {
    const sourceReservations = soldReservations.filter((reservation) => reservation.source === source);
    const amount = sourceReservations.reduce((sum, reservation) => sum + revenueForReservation(reservation.id, folios, folioLines, new Date(`${range.from}T00:00:00+05:30`), new Date(`${range.to}T23:59:59.999+05:30`)), 0);
    return { source, amount, sharePct: roomRevenue ? (amount / roomRevenue) * 100 : 0 };
  });

  return {
    period: range,
    priorPeriod: previousRangeData,
    kpis: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      roomRevenue: Number(roomRevenue.toFixed(2)),
      fbRevenue: Number(fbRevenue.toFixed(2)),
      adr: Number(adr.toFixed(2)),
      revpar: Number(revpar.toFixed(2)),
      occupancyPct: occupancy.kpis.avgOccupancyPct,
      miscRevenue: Number(miscRevenue.toFixed(2)),
      vsprior: {
        totalRevenue: Number((((totalRevenue - previousTotalRevenue) / (previousTotalRevenue || 1)) * 100).toFixed(1)),
        roomRevenue: Number((((roomRevenue - previousRoomRevenue) / (previousRoomRevenue || 1)) * 100).toFixed(1)),
        fbRevenue: Number((((fbRevenue - previousFbRevenue) / (previousFbRevenue || 1)) * 100).toFixed(1)),
        adr: Number((((adr - previous.kpis.adr) / (previous.kpis.adr || 1)) * 100).toFixed(1)),
        revpar: Number((((revpar - previous.kpis.revpar) / (previous.kpis.revpar || 1)) * 100).toFixed(1)),
        occupancyPct: Number((occupancy.kpis.avgOccupancyPct - previous.kpis.avgOccupancyPct).toFixed(1)),
        miscRevenue: Number((((miscRevenue - previousMisc) / (previousMisc || 1)) * 100).toFixed(1)),
      },
    },
    dailySeries,
    byCategory,
    byRoomType,
    bySource,
  };
}

type ReservationsReportRow = {
  id: string;
  source: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  createdAt: Date;
  cancelledAt: Date | null;
  rateSnapshot: unknown;
};

function rateSnapshotTotal(snapshot: unknown, checkIn: Date, checkOut: Date): number {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  const obj = snapshot as Record<string, unknown>;
  const direct = numberize(obj.total ?? obj.amount ?? 0);
  if (direct > 0) return direct;
  const nightly = numberize(obj.nightlyRate ?? obj.ratePerNight ?? 0);
  if (nightly <= 0) return 0;
  const nights = Math.max(1, Math.round((startOfIstDayUtc(checkOut).getTime() - startOfIstDayUtc(checkIn).getTime()) / 86400000));
  return nightly * nights;
}

function nightsBetween(checkIn: Date, checkOut: Date) {
  return Math.max(0, (startOfIstDayUtc(checkOut).getTime() - startOfIstDayUtc(checkIn).getTime()) / 86400000);
}

function leadDays(createdAt: Date, checkIn: Date) {
  return Math.max(0, (startOfIstDayUtc(checkIn).getTime() - startOfIstDayUtc(createdAt).getTime()) / 86400000);
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function getReservationsReport(propertyId: string, range: DateRange) {
  const utc = toUtcRange(range);
  const prior = priorRange(range);
  const priorUtc = toUtcRange(prior);

  const [createdInPeriod, cancelledInPeriod, checkedOutInPeriod, createdInPrior, cancelledInPrior, checkedOutInPrior] = await Promise.all([
    prisma.reservation.findMany({
      where: { propertyId, deletedAt: null, createdAt: { gte: utc.from, lte: utc.to } },
    }),
    prisma.reservation.findMany({
      where: { propertyId, deletedAt: null, cancelledAt: { gte: utc.from, lte: utc.to } },
    }),
    prisma.reservation.findMany({
      where: { propertyId, deletedAt: null, status: 'CHECKED_OUT', checkOut: { gte: utc.from, lte: utc.to } },
    }),
    prisma.reservation.count({
      where: { propertyId, deletedAt: null, createdAt: { gte: priorUtc.from, lte: priorUtc.to } },
    }),
    prisma.reservation.count({
      where: { propertyId, deletedAt: null, cancelledAt: { gte: priorUtc.from, lte: priorUtc.to } },
    }),
    prisma.reservation.findMany({
      where: { propertyId, deletedAt: null, status: 'CHECKED_OUT', checkOut: { gte: priorUtc.from, lte: priorUtc.to } },
    }),
  ]) as [ReservationsReportRow[], ReservationsReportRow[], ReservationsReportRow[], number, number, ReservationsReportRow[]];

  const totalBookings = createdInPeriod.length;
  const newBookings = createdInPeriod.filter((reservation) => reservation.status === 'CONFIRMED').length;
  const newBookingsPrior = createdInPrior; // count fallback — same metric as totalBookings prior
  const cancellations = cancelledInPeriod.length;
  const avgLengthOfStay = avg(checkedOutInPeriod.map((reservation) => nightsBetween(new Date(reservation.checkIn), new Date(reservation.checkOut))));
  const avgLeadTime = avg(createdInPeriod.map((reservation) => leadDays(new Date(reservation.createdAt), new Date(reservation.checkIn))));
  const avgLengthOfStayPrior = avg(checkedOutInPrior.map((reservation) => nightsBetween(new Date(reservation.checkIn), new Date(reservation.checkOut))));

  const dateKeys = listDateKeys(range);
  const bookingVolume = dateKeys.map((date) => {
    const dayCreated = createdInPeriod.filter((reservation) => formatISTDateKey(reservation.createdAt) === date);
    const dayCancelled = cancelledInPeriod.filter((reservation) => reservation.cancelledAt && formatISTDateKey(reservation.cancelledAt) === date);
    return {
      date,
      bookings: dayCreated.length,
      cancellations: dayCancelled.length,
    };
  });

  const sourcesPresent = unique([
    ...createdInPeriod.map((reservation) => reservation.source),
    ...RESERVATION_SOURCES,
  ]);

  const cancelledIds = new Set(cancelledInPeriod.map((reservation) => reservation.id));

  const bySource = sourcesPresent.map((source) => {
    const rows = createdInPeriod.filter((reservation) => reservation.source === source);
    const bookings = rows.length;
    const checkedOutRows = checkedOutInPeriod.filter((reservation) => reservation.source === source);
    const avgLos = avg(checkedOutRows.map((reservation) => nightsBetween(new Date(reservation.checkIn), new Date(reservation.checkOut))));
    const avgLead = avg(rows.map((reservation) => leadDays(new Date(reservation.createdAt), new Date(reservation.checkIn))));
    const cancelledCount = rows.filter((reservation) => cancelledIds.has(reservation.id) || reservation.status === 'CANCELLED').length;
    const cancelRate = bookings ? (cancelledCount / bookings) * 100 : 0;
    const revenue = rows.reduce((sum, reservation) => sum + rateSnapshotTotal(reservation.rateSnapshot, new Date(reservation.checkIn), new Date(reservation.checkOut)), 0);
    return {
      source,
      bookings,
      sharePct: totalBookings ? (bookings / totalBookings) * 100 : 0,
      avgLengthOfStay: Number(avgLos.toFixed(2)),
      avgLeadTime: Number(avgLead.toFixed(2)),
      cancelRate: Number(cancelRate.toFixed(1)),
      revenue: Number(revenue.toFixed(2)),
    };
  });

  const totalRevenue = bySource.reduce((sum, row) => sum + row.revenue, 0);

  return {
    period: range,
    priorPeriod: prior,
    kpis: {
      totalBookings,
      newBookings,
      cancellations,
      avgLengthOfStay: Number(avgLengthOfStay.toFixed(2)),
      avgLeadTime: Number(avgLeadTime.toFixed(2)),
      vsprior: {
        totalBookings: Number((((totalBookings - newBookingsPrior) / (newBookingsPrior || 1)) * 100).toFixed(1)),
        newBookings: Number((newBookings - createdInPrior).toFixed(0)),
        cancellations: Number((cancellations - cancelledInPrior).toFixed(0)),
        avgLengthOfStay: Number((avgLengthOfStay - avgLengthOfStayPrior).toFixed(2)),
        avgLeadTime: 0,
      },
    },
    bookingVolume,
    bySource,
    totalRevenue: Number(totalRevenue.toFixed(2)),
  };
}

type FolioReportLine = {
  folioId: string;
  chargeType: string;
  amount: unknown;
  postedAt: Date;
};

type FolioReportFolio = {
  id: string;
  status: string;
  settledAt: Date | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  ROOM_CHARGE: 'Room Charges',
  EXTRA_CHARGE: 'Extras',
  PAYMENT: 'Payments',
  DISCOUNT: 'Discounts',
  REFUND: 'Refunds',
  TAX_ADJUSTMENT: 'Tax Adjustments',
};

const CHARGE_TYPES = ['ROOM_CHARGE', 'EXTRA_CHARGE'];
const ADJUSTMENT_TYPES = ['DISCOUNT', 'REFUND'];

export async function getFolioReport(propertyId: string, range: DateRange) {
  const utc = toUtcRange(range);
  const prior = priorRange(range);
  const priorUtc = toUtcRange(prior);

  const [periodLinesRaw, openFolios, closedFolios, priorLinesRaw] = await Promise.all([
    prisma.folioLine.findMany({
      where: { propertyId, postedAt: { gte: utc.from, lte: utc.to } },
      orderBy: { postedAt: 'asc' },
    }),
    prisma.folio.findMany({ where: { propertyId, status: 'OPEN', deletedAt: null } }),
    prisma.folio.findMany({
      where: { propertyId, status: 'CLOSED', deletedAt: null, settledAt: { gte: utc.from, lte: utc.to } },
    }),
    prisma.folioLine.findMany({
      where: { propertyId, postedAt: { gte: priorUtc.from, lte: priorUtc.to } },
    }),
  ]) as [FolioReportLine[], FolioReportFolio[], FolioReportFolio[], FolioReportLine[]];

  const allOpenFolioLines = openFolios.length
    ? ((await prisma.folioLine.findMany({
        where: { propertyId, folioId: { in: openFolios.map((folio) => folio.id) } },
      })) as FolioReportLine[])
    : [];

  const closedFolioLines = closedFolios.length
    ? ((await prisma.folioLine.findMany({
        where: { propertyId, folioId: { in: closedFolios.map((folio) => folio.id) } },
      })) as FolioReportLine[])
    : [];

  const sumOf = (rows: FolioReportLine[], types: string[]) =>
    rows.filter((row) => types.includes(row.chargeType)).reduce((sum, row) => sum + numberize(row.amount), 0);

  const totalCharged = sumOf(periodLinesRaw, CHARGE_TYPES);
  const totalCollected = sumOf(periodLinesRaw, ['PAYMENT']);
  const refundsAdjustments = sumOf(periodLinesRaw, [...ADJUSTMENT_TYPES, 'TAX_ADJUSTMENT']);

  const openCharges = sumOf(allOpenFolioLines, CHARGE_TYPES);
  const openPayments = sumOf(allOpenFolioLines, ['PAYMENT']);
  const openAdjustments = sumOf(allOpenFolioLines, ADJUSTMENT_TYPES);
  const outstanding = openCharges - openPayments - openAdjustments;

  const closedFolioTotals = closedFolios.map((folio) => {
    const lines = closedFolioLines.filter((line) => line.folioId === folio.id);
    return sumOf(lines, CHARGE_TYPES);
  });
  const avgFolioValue = closedFolioTotals.length
    ? closedFolioTotals.reduce((sum, value) => sum + value, 0) / closedFolioTotals.length
    : 0;

  const priorTotalCharged = sumOf(priorLinesRaw, CHARGE_TYPES);
  const priorTotalCollected = sumOf(priorLinesRaw, ['PAYMENT']);
  const priorRefunds = sumOf(priorLinesRaw, [...ADJUSTMENT_TYPES, 'TAX_ADJUSTMENT']);

  const dateKeys = listDateKeys(range);
  const dailyTrend = dateKeys.map((date) => {
    const dayLines = periodLinesRaw.filter((line) => formatISTDateKey(line.postedAt) === date);
    return {
      date,
      charged: Number(sumOf(dayLines, CHARGE_TYPES).toFixed(2)),
      collected: Number(sumOf(dayLines, ['PAYMENT']).toFixed(2)),
    };
  });

  const presentTypes = unique(periodLinesRaw.map((line) => line.chargeType));
  const totalsByType = presentTypes.map((chargeType) => {
    const lines = periodLinesRaw.filter((line) => line.chargeType === chargeType);
    const grossPosted = lines.reduce((sum, line) => sum + numberize(line.amount), 0);
    const folios = unique(lines.map((line) => line.folioId)).length;
    return { chargeType, grossPosted, folios };
  });

  const grossChargesTotal = totalsByType
    .filter((row) => CHARGE_TYPES.includes(row.chargeType))
    .reduce((sum, row) => sum + row.grossPosted, 0);
  const adjustmentsTotal = totalsByType
    .filter((row) => ADJUSTMENT_TYPES.includes(row.chargeType))
    .reduce((sum, row) => sum + row.grossPosted, 0);
  const netRevenueTotal = grossChargesTotal - adjustmentsTotal;

  const byCategory = totalsByType
    .map((row) => {
      const isCharge = CHARGE_TYPES.includes(row.chargeType);
      const isAdjustment = ADJUSTMENT_TYPES.includes(row.chargeType);
      const adjustmentsForRow = isCharge ? -adjustmentsTotal : 0;
      const netRevenue = isCharge
        ? row.grossPosted + adjustmentsForRow
        : isAdjustment
          ? -row.grossPosted
          : row.grossPosted;
      return {
        category: row.chargeType,
        label: CATEGORY_LABEL[row.chargeType] ?? row.chargeType,
        folios: row.folios,
        grossPosted: Number(row.grossPosted.toFixed(2)),
        adjustments: isCharge ? Number(adjustmentsForRow.toFixed(2)) : 0,
        netRevenue: Number(netRevenue.toFixed(2)),
        pctOfTotal: netRevenueTotal > 0 ? Number(((netRevenue / netRevenueTotal) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.grossPosted - a.grossPosted);

  const overdueDays = 2;
  const nowMs = Date.now();
  const outstandingFolios = openFolios
    .map((folio) => {
      const lines = allOpenFolioLines.filter((line) => line.folioId === folio.id);
      const charges = sumOf(lines, CHARGE_TYPES);
      const payments = sumOf(lines, ['PAYMENT']);
      const adjustments = sumOf(lines, ADJUSTMENT_TYPES);
      const balance = charges - payments - adjustments;
      const lastPostedAt = lines.reduce((latest: Date | null, line) => {
        const posted = new Date(line.postedAt);
        return !latest || posted > latest ? posted : latest;
      }, null);
      const ageDays = lastPostedAt ? Math.floor((nowMs - lastPostedAt.getTime()) / 86400000) : 0;
      return { folioId: folio.id, balance, ageDays, overdue: ageDays >= overdueDays };
    })
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  return {
    period: range,
    priorPeriod: prior,
    kpis: {
      totalCharged: Number(totalCharged.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      outstanding: Number(outstanding.toFixed(2)),
      avgFolioValue: Number(avgFolioValue.toFixed(2)),
      refundsAdjustments: Number(refundsAdjustments.toFixed(2)),
      collectionRate: totalCharged > 0 ? Number(((totalCollected / totalCharged) * 100).toFixed(1)) : 0,
      openFolioCount: openFolios.length,
      closedFolioCount: closedFolios.length,
      vsprior: {
        totalCharged: Number((((totalCharged - priorTotalCharged) / (priorTotalCharged || 1)) * 100).toFixed(1)),
        totalCollected: Number((((totalCollected - priorTotalCollected) / (priorTotalCollected || 1)) * 100).toFixed(1)),
        refundsAdjustments: Number((((refundsAdjustments - priorRefunds) / (priorRefunds || 1)) * 100).toFixed(1)),
      },
    },
    dailyTrend,
    byCategory,
    outstandingFolios,
    netRevenueTotal: Number(netRevenueTotal.toFixed(2)),
  };
}

export async function getAlerts(propertyId: string, status: 'active' | 'all' = 'active') {
  const alerts = await prisma.alert.findMany({
    where: {
      propertyId,
      ...(status === 'active' ? { status: 'ACTIVE' } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    alerts,
    total: alerts.length,
  };
}

export async function getRoomsNeedingAttention(propertyId: string) {
  const ATTENTION = ['DIRTY', 'CLEAN', 'OUT_OF_ORDER', 'MAINTENANCE'];
  const [rooms, blocks, roomTypes] = await Promise.all([
    prisma.room.findMany({
      where: { propertyId, deletedAt: null, state: { in: ATTENTION } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.roomBlock.findMany({
      where: { propertyId, deletedAt: null, endDate: { gte: new Date() } },
    }),
    prisma.roomType.findMany({
      where: { propertyId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);
  const blockMap = new Map(blocks.map((b) => [b.roomId, b]));
  const typeMap = new Map(roomTypes.map((t) => [t.id, t.name]));
  const items = rooms.map((r) => {
    const b = blockMap.get(r.id);
    return {
      roomId: r.id,
      roomNumber: r.number,
      roomType: typeMap.get(r.roomTypeId) ?? 'Room',
      housekeepingState: r.state,
      blockType: b?.blockType ?? null,
      blockEndDate: b?.endDate ?? null,
      blockReason: b?.reason ?? null,
      lastUpdatedAt: r.updatedAt,
      stateVersion: r.stateVersion,
    };
  });
  return {
    count: items.length,
    items,
    rooms: items,
    fetchedAt: new Date().toISOString(),
  };
}
