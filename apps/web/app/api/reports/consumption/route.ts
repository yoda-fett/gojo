import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { parseDateRange } from '@/lib/dashboard/date-range';
import { consumptionReportCsv, getConsumptionReport } from '@/lib/services/consumption-report';

export const GET = withAuth(async (req, actor) => {
  const params = new URL(req.url).searchParams;
  const range = parseDateRange(params.get('from') ?? params.get('startDate'), params.get('to') ?? params.get('endDate'), '30d');
  const report = await getConsumptionReport(actor.propertyId, range);
  if (params.get('format') === 'csv') {
    return new Response(consumptionReportCsv(report), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="consumption-${range.from}-${range.to}.csv"`,
      },
    });
  }
  return NextResponse.json(report);
}, ['OWNER', 'MANAGER']);
