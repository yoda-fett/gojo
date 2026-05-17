// @ts-nocheck
// Story 12.6 — First-Shift Reconciliation Report page. Server-rendered so
// the row data is consistent on first paint; the client just renders the
// table + Mark-reviewed button.
import { prisma } from '@gojo/db';
import { redirect } from 'next/navigation';

import { getServerActor } from '@/lib/auth/server-actor';
import { computeReconciliationRows } from '@/lib/services/first-shift-reconciliation';

import { ReconciliationClient } from './_components/reconciliation-client';

export const dynamic = 'force-dynamic';

export default async function ReconciliationPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');

  const [property, rows] = await Promise.all([
    prisma.property.findUnique({
      where: { id: actor.propertyId },
      select: { coldStartCompletedAt: true, coldStartLinenDeferred: true, firstShiftReconciledAt: true },
    }),
    computeReconciliationRows(actor.propertyId, prisma),
  ]);
  if (!property) return null;

  return (
    <ReconciliationClient
      reviewedAt={property.firstShiftReconciledAt ? property.firstShiftReconciledAt.toISOString() : null}
      rows={rows}
    />
  );
}
