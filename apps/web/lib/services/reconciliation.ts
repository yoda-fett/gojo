// @ts-nocheck
import { checkSubscriptionGate, prisma, reconcile, writeAuditLog } from '@gojo/db';
import type { GatewayTxn, LedgerTxn } from '@gojo/db';
import { AppError } from '@gojo/types';

/**
 * UPI settlement reconciliation runner (Story 7.5).
 *
 * In production this would be invoked by a BullMQ scheduled job at 02:00
 * IST per property. BullMQ scheduling isn't wired in Phase 2; expose this
 * as a callable function (POST /api/internal/reconcile) so it can be
 * triggered manually until the cron is added.
 */
async function fetchSettlementFromGateway(
  propertyId: string,
  date: Date,
): Promise<GatewayTxn[]> {
  // Real gateway integration TBD (vendor TBD per Story 7.2). Until then,
  // mirror the ledger so MATCHED is the default outcome and discrepancies
  // can be injected for testing.
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const lines = await prisma.folioLine.findMany({
    where: {
      propertyId,
      chargeType: 'UPI_PAYMENT',
      postedAt: { gte: start, lt: end },
    },
  });
  return lines.map((line) => ({
    gatewayOrderId: extractOrderId(line.description),
    settledAmount: Math.abs(Number(line.amount)),
  }));
}

function extractOrderId(description: string) {
  const match = description.match(/UPI-[A-Z0-9]+/);
  return match?.[0] ?? '';
}

async function fetchLedgerForDate(propertyId: string, date: Date): Promise<LedgerTxn[]> {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const lines = await prisma.folioLine.findMany({
    where: {
      propertyId,
      chargeType: 'UPI_PAYMENT',
      postedAt: { gte: start, lt: end },
    },
  });

  const folioIds = Array.from(new Set(lines.map((l) => l.folioId)));
  const folios = await prisma.folio.findMany({ where: { id: { in: folioIds } } });
  const folioMap = new Map(folios.map((f) => [f.id, f]));
  const reservationIds = folios.map((f) => f.reservationId);
  const reservations = await prisma.reservation.findMany({
    where: { id: { in: reservationIds } },
    select: { id: true, bookingReference: true },
  });
  const refMap = new Map(reservations.map((r) => [r.id, r.bookingReference ?? '']));

  return lines.map((line) => {
    const folio = folioMap.get(line.folioId);
    return {
      gatewayOrderId: extractOrderId(line.description),
      amount: Math.abs(Number(line.amount)),
      bookingRef: folio ? refMap.get(folio.reservationId) ?? '' : '',
    };
  });
}

/** @gateExempt Scheduled reconciliation job — system context, no Owner actor. */
export async function runReconciliation({
  propertyId,
  date,
}: {
  propertyId: string;
  date: Date;
}) {
  const dateOnly = new Date(date);
  dateOnly.setUTCHours(0, 0, 0, 0);

  let gateway: GatewayTxn[] = [];
  try {
    gateway = await fetchSettlementFromGateway(propertyId, dateOnly);
  } catch (error) {
    const recon = await prisma.upiSettlementReconciliation.upsert({
      where: { date_propertyId: { date: dateOnly, propertyId } },
      create: {
        propertyId,
        date: dateOnly,
        totalGatewayTransactions: 0,
        totalLedgerTransactions: 0,
        discrepancyCount: 0,
        status: 'FAILED',
        errorReason: error instanceof Error ? error.message : 'Gateway unreachable',
        lines: [],
      },
      update: {
        status: 'FAILED',
        errorReason: error instanceof Error ? error.message : 'Gateway unreachable',
        runAt: new Date(),
      },
    });
    await prisma.alert.create({
      data: {
        propertyId,
        alertType: 'RECONCILIATION_FAILED',
        severity: 'MEDIUM',
        message: "Daily UPI reconciliation could not run — gateway unreachable. We'll retry automatically.",
        entityId: recon.id,
        entityType: 'RECONCILIATION',
      },
    });
    return recon;
  }

  const ledger = await fetchLedgerForDate(propertyId, dateOnly);
  const result = reconcile(gateway, ledger);

  const status = result.discrepancyCount === 0 ? 'CLEAN' : 'DISCREPANCY';

  return prisma.$transaction(async (tx) => {
    const existing = await tx.upiSettlementReconciliation.findUnique({
      where: { date_propertyId: { date: dateOnly, propertyId } },
    });
    const recon = existing
      ? await tx.upiSettlementReconciliation.update({
          where: { id: existing.id },
          data: {
            totalGatewayTransactions: result.totalGatewayTransactions,
            totalLedgerTransactions: result.totalLedgerTransactions,
            discrepancyCount: result.discrepancyCount,
            status,
            errorReason: null,
            runAt: new Date(),
            lines: result.lines as never,
          },
        })
      : await tx.upiSettlementReconciliation.create({
          data: {
            propertyId,
            date: dateOnly,
            totalGatewayTransactions: result.totalGatewayTransactions,
            totalLedgerTransactions: result.totalLedgerTransactions,
            discrepancyCount: result.discrepancyCount,
            status,
            lines: result.lines as never,
          },
        });

    if (existing) {
      await tx.reconciliationDiscrepancy.deleteMany({
        where: { reconciliationId: existing.id, status: 'UNRESOLVED' },
      });
    }
    for (const line of result.lines) {
      if (line.result === 'MATCHED') continue;
      await tx.reconciliationDiscrepancy.create({
        data: {
          reconciliationId: recon.id,
          propertyId,
          date: dateOnly,
          bookingRef: line.bookingRef,
          gatewayOrderId: line.gatewayOrderId,
          gatewayAmount: line.gatewayAmount,
          ledgerAmount: line.ledgerAmount,
          discrepancyType: line.result,
          status: 'UNRESOLVED',
        },
      });
    }

    if (result.discrepancyCount > 0) {
      await tx.alert.create({
        data: {
          propertyId,
          alertType: 'RECONCILIATION_DISCREPANCY',
          severity: 'HIGH',
          message: `UPI settlement mismatch — ${result.discrepancyCount} transactions need review`,
          entityId: recon.id,
          entityType: 'RECONCILIATION',
        },
      });
    }

    return recon;
  });
}

export async function acknowledgeDiscrepancy({
  discrepancyId,
  actor,
}: {
  discrepancyId: string;
  actor: { userId: string; propertyId: string; role: string };
}) {
  // NOTE 10-1b: 'reconciliation.acknowledge' is not yet in Action union — using string form.
  await checkSubscriptionGate(actor, 'reconciliation.acknowledge', prisma);
  const existing = await prisma.reconciliationDiscrepancy.findFirst({
    where: { id: discrepancyId, propertyId: actor.propertyId },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Discrepancy not found', 404);
  if (existing.status === 'ACKNOWLEDGED') {
    throw new AppError('RECONCILIATION_ALREADY_ACKNOWLEDGED', 'Already acknowledged', 409);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reconciliationDiscrepancy.update({
      where: { id: discrepancyId },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: actor.userId },
    });
    await writeAuditLog(tx, actor as never, {
      action: 'RECONCILIATION_DISCREPANCY_ACKNOWLEDGED',
      entityType: 'RECONCILIATION_DISCREPANCY',
      entityId: discrepancyId,
      before: { status: existing.status },
      after: { status: updated.status },
      metadata: { gatewayOrderId: existing.gatewayOrderId, bookingRef: existing.bookingRef },
    });
    return updated;
  });
}
