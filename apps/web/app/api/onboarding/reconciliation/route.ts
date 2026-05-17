// @ts-nocheck
// Story 12.6 — read the first-shift reconciliation report. Available to the
// Owner even after Mark-reviewed (historical view); the UI flips read-only.
import { prisma } from '@gojo/db';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { computeReconciliationRows } from '@/lib/services/first-shift-reconciliation';

export const GET = withAuth(async (_req, actor) => {
  const [property, rows] = await Promise.all([
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: { coldStartCompletedAt: true, coldStartLinenDeferred: true, firstShiftReconciledAt: true },
    }),
    computeReconciliationRows(actor.propertyId, prisma),
  ]);
  return NextResponse.json({
    property: {
      coldStartCompletedAt: property?.coldStartCompletedAt ?? null,
      coldStartLinenDeferred: property?.coldStartLinenDeferred ?? false,
      firstShiftReconciledAt: property?.firstShiftReconciledAt ?? null,
    },
    rows,
  });
}, ['OWNER']);
