// @ts-nocheck
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return withAuth(async (_request, actor) => {
    const recon = await prisma.upiSettlementReconciliation.findFirst({
      where: { id, propertyId: actor.propertyId },
    });
    if (!recon) {
      return NextResponse.json({ code: 'RECONCILIATION_NOT_FOUND', message: 'Not found' }, { status: 404 });
    }
    const discrepancies = await prisma.reconciliationDiscrepancy.findMany({
      where: { reconciliationId: id, propertyId: actor.propertyId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ reconciliation: recon, discrepancies });
  }, ['OWNER', 'MANAGER'])(req as never);
}
