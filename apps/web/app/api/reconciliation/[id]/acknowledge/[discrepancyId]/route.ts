// @ts-nocheck
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { acknowledgeDiscrepancy } from '@/lib/services/reconciliation';

type Context = { params: Promise<{ id: string; discrepancyId: string }> };

export async function POST(req: Request, context: Context) {
  const { discrepancyId } = await context.params;
  return withAuth(async (_request, actor) => {
    try {
      const updated = await acknowledgeDiscrepancy({ discrepancyId, actor });
      return NextResponse.json(updated);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
      }
      throw error;
    }
  }, ['OWNER', 'MANAGER'])(req as never);
}
