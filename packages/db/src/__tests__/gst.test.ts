import { describe, expect, it } from 'vitest';

import { calculateGST, pickSlabForPostDiscount, roundTo2Decimals } from '../gst.js';

describe('calculateGST', () => {
  it('AC1: applies 12% slab at boundary (₹7,500)', () => {
    expect(calculateGST(7500, '12%')).toEqual({
      taxableAmount: 7500,
      cgst: 450,
      sgst: 450,
      total: 8400,
    });
  });

  it('AC2: applies 18% slab with 2-decimal precision', () => {
    expect(calculateGST(7501, '18%')).toEqual({
      taxableAmount: 7501,
      cgst: 675.09,
      sgst: 675.09,
      total: 8851.18,
    });
  });

  it('AC6: zero-rated slab returns zero tax', () => {
    expect(calculateGST(5000, '0%')).toEqual({
      taxableAmount: 5000,
      cgst: 0,
      sgst: 0,
      total: 5000,
    });
  });

  it('handles zero amount', () => {
    expect(calculateGST(0, '12%')).toEqual({
      taxableAmount: 0,
      cgst: 0,
      sgst: 0,
      total: 0,
    });
  });

  it('rejects negative amount', () => {
    expect(() => calculateGST(-1, '12%')).toThrow(/INVALID_GST_AMOUNT|non-negative/);
  });

  it('rejects invalid slab', () => {
    // @ts-expect-error invalid slab on purpose
    expect(() => calculateGST(5000, '5%')).toThrow(/INVALID_GST_SLAB|GST slab/);
  });

  it('handles large amounts without overflow', () => {
    const result = calculateGST(9999999.99, '18%');
    expect(result.taxableAmount).toBe(9999999.99);
    expect(result.cgst).toBeCloseTo(900000, 0);
  });
});

describe('pickSlabForPostDiscount', () => {
  it('returns 12% at the ₹7,500 boundary', () => {
    expect(pickSlabForPostDiscount(7500)).toBe('12%');
  });

  it('returns 18% just over the boundary', () => {
    expect(pickSlabForPostDiscount(7500.01)).toBe('18%');
  });

  it('returns 0% for non-positive amounts', () => {
    expect(pickSlabForPostDiscount(0)).toBe('0%');
  });
});

describe('roundTo2Decimals', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundTo2Decimals(7501 * 0.09)).toBe(675.09);
    expect(roundTo2Decimals(0.005)).toBe(0.01);
  });
});
