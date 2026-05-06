// @ts-nocheck
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getRevenueReport } from '@/lib/dashboard/data';
import { parseDateRange } from '@/lib/dashboard/date-range';

export const GET = withAuth(async (req, actor) => {
  const { searchParams } = new URL(req.url);
  const range = parseDateRange(searchParams.get('startDate'), searchParams.get('endDate'), '30d');
  const data = await getRevenueReport(actor.propertyId, range);

  const lines = [
    '# KPI Summary',
    'Metric,This Period,Change %',
    `Total Revenue,₹${data.kpis.totalRevenue.toFixed(2)},${data.kpis.vsprior.totalRevenue.toFixed(1)}%`,
    `Room Revenue,₹${data.kpis.roomRevenue.toFixed(2)},${data.kpis.vsprior.roomRevenue.toFixed(1)}%`,
    `F&B Revenue,₹${data.kpis.fbRevenue.toFixed(2)},${data.kpis.vsprior.fbRevenue.toFixed(1)}%`,
    `ADR,₹${data.kpis.adr.toFixed(2)},${data.kpis.vsprior.adr.toFixed(1)}%`,
    `RevPAR,₹${data.kpis.revpar.toFixed(2)},${data.kpis.vsprior.revpar.toFixed(1)}%`,
    '',
    '# Revenue by Category',
    'Category,Transactions,Share %,vs Prior %,Amount',
    ...data.byCategory.map((row) => `${String(row.category)},${row.transactions},${row.sharePct.toFixed(1)}%,${row.vsPriorPct.toFixed(1)}%,₹${row.amount.toFixed(2)}`),
    '',
    '# Room Revenue by Type',
    'Room Type,Rooms,Nights Sold,ADR,Occupancy %,Revenue',
    ...data.byRoomType.map((row) => `${String(row.roomType)},${row.roomCount},${row.nightsSold},₹${row.adr.toFixed(2)},${row.occupancyPct.toFixed(1)}%,₹${row.revenue.toFixed(2)}`),
  ];

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="revenue-report-${String(range.from)}-${String(range.to)}.csv"`,
    },
  });
}, ['OWNER', 'MANAGER']);
