import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { approveIssueReports } from '@/lib/services/housekeeping-inventory';

type Context = { params?: Promise<{ id: string }> };

export const POST = withAuth(async (req, actor, context) => {
  const { id } = (await (context as Context | undefined)?.params) ?? { id: '' };
  const ids = new URL(req.url).searchParams.get('ids');
  const result = await approveIssueReports(actor, id, ids);
  return NextResponse.json(result);
}, ['OWNER', 'MANAGER']);
