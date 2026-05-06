import { describe, expect, it } from 'vitest';

import { reconcile } from '../reconciliation.js';

describe('reconcile', () => {
  it('marks matched transactions', () => {
    const result = reconcile(
      [{ gatewayOrderId: 'UPI-1', settledAmount: 1000 }],
      [{ gatewayOrderId: 'UPI-1', amount: 1000, bookingRef: 'GJ-1' }],
    );
    expect(result.discrepancyCount).toBe(0);
    expect(result.lines[0]?.result).toBe('MATCHED');
  });

  it('flags amount mismatch', () => {
    const result = reconcile(
      [{ gatewayOrderId: 'UPI-1', settledAmount: 1000 }],
      [{ gatewayOrderId: 'UPI-1', amount: 999, bookingRef: 'GJ-1' }],
    );
    expect(result.discrepancyCount).toBe(1);
    expect(result.lines[0]?.result).toBe('AMOUNT_MISMATCH');
  });

  it('flags missing in ledger', () => {
    const result = reconcile(
      [{ gatewayOrderId: 'UPI-1', settledAmount: 1000 }],
      [],
    );
    expect(result.lines[0]?.result).toBe('MISSING_IN_LEDGER');
  });

  it('flags missing in gateway', () => {
    const result = reconcile(
      [],
      [{ gatewayOrderId: 'UPI-1', amount: 1000, bookingRef: 'GJ-1' }],
    );
    expect(result.lines[0]?.result).toBe('MISSING_IN_GATEWAY');
  });

  it('treats sub-paise differences as matched', () => {
    const result = reconcile(
      [{ gatewayOrderId: 'UPI-1', settledAmount: 1000.001 }],
      [{ gatewayOrderId: 'UPI-1', amount: 1000, bookingRef: 'GJ-1' }],
    );
    expect(result.discrepancyCount).toBe(0);
  });
});
