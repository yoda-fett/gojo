// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getOccupancyReport } from '@/lib/dashboard/data';
import { parseDateRange } from '@/lib/dashboard/date-range';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  const range = parseDateRange(searchParams.get('startDate'), searchParams.get('endDate'), '30d');
  const data = await getOccupancyReport(actor.propertyId, range);
  const lines = [
    '# KPI Summary',
    'Metric,Value,vs Prior Period',
    `Avg Occupancy %,${data.kpis.avgOccupancyPct.toFixed(1)}%,${data.kpis.vsprior.avgOccupancyPct.toFixed(1)}%`,
    `ADR,₹${data.kpis.adr.toFixed(2)},${data.kpis.vsprior.adr.toFixed(1)}%`,
    `RevPAR,₹${data.kpis.revpar.toFixed(2)},${data.kpis.vsprior.revpar.toFixed(1)}%`,
    `Total Room Nights,${data.kpis.totalRoomNights},${data.kpis.vsprior.totalRoomNights.toFixed(1)}%`,
    '',
    '# Room Type Breakdown',
    'Room Type,Rooms,Nights Sold,Available Nights,ADR,Occupancy %',
    ...data.byRoomType.map((row) => `${String(row.roomType)},${row.roomCount},${row.nightsSold},${row.availableNights},₹${row.adr.toFixed(2)},${row.occupancyPct.toFixed(1)}%`),
    '',
    '# Weekday Averages',
    'Day,Avg Occupancy %',
    ...data.byWeekday.map((row) => `${row.weekday},${row.avgOccupancyPct.toFixed(1)}%`),
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="occupancy-report-${String(range.from)}-${String(range.to)}.csv"`,
    },
  });
}, ['OWNER', 'MANAGER']);
