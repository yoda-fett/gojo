// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export const GET = withAuth(async (req, actor) => {
  const url = new URL(req.url);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = parseDate(url.searchParams.get('from'), monthStart);
  const to = parseDate(url.searchParams.get('to'), now);

  const [property, reservations, recent] = await Promise.all([
    prisma.property.findFirst({ where: { id: actor.propertyId, deletedAt: null } }),
    prisma.reservation.findMany({
      where: {
        propertyId: actor.propertyId,
        deletedAt: null,
        source: 'DIRECT_BOOKING',
        createdAt: { gte: from, lte: to },
      },
      select: { id: true, bookingReference: true, checkIn: true, guestId: true, rateSnapshot: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.reservation.findMany({
      where: { propertyId: actor.propertyId, deletedAt: null, source: 'DIRECT_BOOKING' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, bookingReference: true, checkIn: true, guestId: true },
    }),
  ]);

  const directBookingCount = reservations.length;
  const totalRevenue = reservations.reduce((sum, r) => {
    const total = (r.rateSnapshot as Record<string, unknown> | null)?.total;
    return sum + (typeof total === 'number' ? total : Number(total ?? 0));
  }, 0);
  const averageRevenue = directBookingCount > 0 ? totalRevenue / directBookingCount : 0;
  const rate = property?.averageOtaCommissionRate ?? 0.18;
  const estimatedCommissionSaved = directBookingCount * averageRevenue * rate;

  const guestIds = Array.from(new Set(recent.map((r) => r.guestId)));
  const guests = await prisma.guest.findMany({
    where: { id: { in: guestIds } },
    select: { id: true, fullName: true },
  });
  const guestMap = new Map(guests.map((g) => [g.id, g.fullName]));

  return NextResponse.json({
    directBookingEnabled: property?.directBookingEnabled ?? false,
    bookingSlug: property?.bookingSlug ?? null,
    averageOtaCommissionRate: rate,
    directBookingCount,
    estimatedCommissionSaved,
    averageRevenue,
    recent: recent.map((r) => ({
      id: r.id,
      bookingReference: r.bookingReference,
      checkIn: r.checkIn,
      guestName: guestMap.get(r.guestId) ?? 'Guest',
    })),
  });
}, ['OWNER', 'MANAGER']);
