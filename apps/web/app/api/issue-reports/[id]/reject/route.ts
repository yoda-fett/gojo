import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { rejectIssueReports } from '@/lib/services/housekeeping-inventory';

type Context = { params?: Promise<{ id: string }> };

export const POST = withAuth(async (req, actor, context) => {
  const { id } = (await (context as Context | undefined)?.params) ?? { id: '' };
  const ids = new URL(req.url).searchParams.get('ids');
  const body = await req.json().catch(() => ({}));
  const result = await rejectIssueReports(actor, id, ids, body);
  return NextResponse.json(result);
}, ['OWNER', 'MANAGER']);
