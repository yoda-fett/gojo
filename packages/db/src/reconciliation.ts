/**
 * UPI settlement reconciliation comparison logic.
 * Pure functions; no I/O. Story 7.5.
 */

export type DiscrepancyType =
  | 'AMOUNT_MISMATCH'
  | 'MISSING_IN_LEDGER'
  | 'MISSING_IN_GATEWAY';

export interface GatewayTxn {
  gatewayOrderId: string;
  settledAmount: number;
}

export interface LedgerTxn {
  gatewayOrderId: string;
  amount: number;
  bookingRef: string;
}

export interface ReconcileLine {
  gatewayOrderId: string;
  bookingRef: string;
  gatewayAmount: number;
  ledgerAmount: number;
  result: 'MATCHED' | DiscrepancyType;
}

export interface ReconcileResult {
  lines: ReconcileLine[];
  matchedCount: number;
  discrepancyCount: number;
  totalGatewayTransactions: number;
  totalLedgerTransactions: number;
}

const EPSILON = 0.01;

export function reconcile(gateway: GatewayTxn[], ledger: LedgerTxn[]): ReconcileResult {
  const ledgerByOrder = new Map<string, LedgerTxn>();
  for (const row of ledger) ledgerByOrder.set(row.gatewayOrderId, row);

  const seenLedger = new Set<string>();
  const lines: ReconcileLine[] = [];

  for (const g of gateway) {
    const l = ledgerByOrder.get(g.gatewayOrderId);
    if (!l) {
      lines.push({
        gatewayOrderId: g.gatewayOrderId,
        bookingRef: '',
        gatewayAmount: g.settledAmount,
        ledgerAmount: 0,
        result: 'MISSING_IN_LEDGER',
      });
      continue;
    }
    seenLedger.add(g.gatewayOrderId);
    if (Math.abs(g.settledAmount - l.amount) > EPSILON) {
      lines.push({
        gatewayOrderId: g.gatewayOrderId,
        bookingRef: l.bookingRef,
        gatewayAmount: g.settledAmount,
        ledgerAmount: l.amount,
        result: 'AMOUNT_MISMATCH',
      });
    } else {
      lines.push({
        gatewayOrderId: g.gatewayOrderId,
        bookingRef: l.bookingRef,
        gatewayAmount: g.settledAmount,
        ledgerAmount: l.amount,
        result: 'MATCHED',
      });
    }
  }

  for (const l of ledger) {
    if (seenLedger.has(l.gatewayOrderId)) continue;
    lines.push({
      gatewayOrderId: l.gatewayOrderId,
      bookingRef: l.bookingRef,
      gatewayAmount: 0,
      ledgerAmount: l.amount,
      result: 'MISSING_IN_GATEWAY',
    });
  }

  const discrepancyCount = lines.filter((l) => l.result !== 'MATCHED').length;
  const matchedCount = lines.length - discrepancyCount;

  return {
    lines,
    matchedCount,
    discrepancyCount,
    totalGatewayTransactions: gateway.length,
    totalLedgerTransactions: ledger.length,
  };
}
