// @ts-nocheck
// Story 12.6 AC5 — Mark reviewed. Stamps firstShiftReconciledAt, resolves
// the FIRST_SHIFT_RECONCILED alert, and writes the FIRST_SHIFT_RECONCILED
// AuditLog with { varianceCount, totalItemsCompared }.
import { prisma } from '@gojo/db';
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { computeReconciliationRows } from '@/lib/services/first-shift-reconciliation';

export const POST = withAuth(async (_req, actor) => {
  const result = await prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({
      where: { id: actor.propertyId },
      select: { firstShiftReconciledAt: true },
    });
    if (property?.firstShiftReconciledAt) {
      throw new AppError('CONFLICT', 'First-shift reconciliation has already been reviewed', 409);
    }

    const rows = await computeReconciliationRows(actor.propertyId, tx);
    const varianceCount = rows.filter((r) => r.severity !== 'CLEAN').length;
    const totalItemsCompared = rows.length;

    const reviewedAt = new Date();
    await tx.property.update({
      where: { id: actor.propertyId },
      data: { firstShiftReconciledAt: reviewedAt },
    });

    await tx.alert.updateMany({
      where: { propertyId: actor.propertyId, alertType: 'FIRST_SHIFT_RECONCILED', status: 'ACTIVE' },
      data: { status: 'RESOLVED', resolvedAt: reviewedAt },
    });

    await tx.auditLog.create({
      data: {
        propertyId: actor.propertyId,
        entityType: 'PROPERTY',
        entityId: actor.propertyId,
        action: 'FIRST_SHIFT_RECONCILED',
        actorId: actor.userId,
        actorRole: actor.role,
        metadata: { varianceCount, totalItemsCompared },
      },
    });

    return { varianceCount, totalItemsCompared, reviewedAt };
  });

  return NextResponse.json(result);
}, ['OWNER']);
