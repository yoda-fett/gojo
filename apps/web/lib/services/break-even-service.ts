// @ts-nocheck
import { prisma } from '@gojo/db';
import { subDays } from 'date-fns';
import { AppError } from '@gojo/types';

import { startOfIstDayUtc } from '@/lib/tz';

function sumValues(values) {
  return Object.values(values).reduce((sum, value) => sum + Number(value ?? 0), 0);
}

export function calculateBreakEven(costConfig, occupancyPct) {
  if (!costConfig?.totalRooms || costConfig.totalRooms <= 0 || occupancyPct <= 0) {
    return null;
  }

  const totalFixedPerMonth = sumValues(costConfig.fixedCosts);
  const variablePerNight = sumValues(costConfig.variableCosts);
  const fixedPerRoomNight = totalFixedPerMonth / costConfig.totalRooms / 30 / (occupancyPct / 100);
  return Math.ceil(fixedPerRoomNight + variablePerNight);
}

export async function getOccupancyAssumption(propertyId, totalRooms) {
  if (!totalRooms || totalRooms <= 0) {
    return {
      pct: 60,
      basedOnBookings: 0,
      note: 'Add at least one room to start calculating a meaningful break-even rate.',
    };
  }

  const thirtyDaysAgo = startOfIstDayUtc(subDays(new Date(), 30));
  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      deletedAt: null,
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      checkIn: { gte: thirtyDaysAgo },
    },
  });

  if (reservations.length < 7) {
    return {
      pct: 60,
      basedOnBookings: reservations.length,
      note: 'Using 60% estimate — add more bookings for a personalised rate.',
    };
  }

  // Raw SQL kept local to this service because Prisma aggregate does not support date arithmetic.
  const rows = await prisma.$queryRaw`
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (check_out - check_in)) / 86400), 0) AS total_nights
    FROM reservations
    WHERE property_id = ${propertyId}
      AND status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND check_in >= ${thirtyDaysAgo}
      AND deleted_at IS NULL
  `;

  const totalNights = Number(rows?.[0]?.total_nights ?? 0);
  const pct = Math.min(100, Math.max(1, Math.round((totalNights / (totalRooms * 30)) * 100)));
  return {
    pct,
    basedOnBookings: reservations.length,
    note: null,
  };
}

export async function getBreakEvenForRoomType(actor, roomTypeId) {
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, propertyId: actor.propertyId, deletedAt: null },
  });
  if (!roomType) {
    throw new AppError('PROPERTY_ACCESS_DENIED', 'Room type not found', 403);
  }

  const property = await prisma.property.findFirst({
    where: { id: actor.propertyId, deletedAt: null },
  });

  if (!property) {
    throw new AppError('NOT_FOUND', 'Property not found', 404);
  }

  if (!property.costConfig) {
    return { breakEvenRate: null, reason: 'NO_COST_CONFIG' };
  }

  const costConfig = property.costConfig;
  const occupancy = await getOccupancyAssumption(actor.propertyId, costConfig.totalRooms);
  const breakEvenRate = calculateBreakEven(costConfig, occupancy.pct);
  const currentRoomCount = await prisma.room.count({
    where: { propertyId: actor.propertyId, deletedAt: null },
  });

  const noteParts = [occupancy.note];
  if (currentRoomCount !== costConfig.totalRooms) {
    noteParts.push(`Based on ${costConfig.totalRooms} rooms at time of cost setup — you now have ${currentRoomCount} rooms. Re-save your cost configuration to update.`);
  }

  return {
    breakEvenRate,
    occupancyAssumption: occupancy.pct,
    basedOnConfirmedBookings: occupancy.basedOnBookings,
    calculationNote: noteParts.filter(Boolean).join(' ') || null,
  };
}
