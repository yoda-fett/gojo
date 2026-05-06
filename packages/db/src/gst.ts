import { AppError } from '@gojo/types';

const GST_RATES = {
  '0%': 0,
  '12%': 0.12,
  '18%': 0.18,
} as const;

export type GstSlab = keyof typeof GST_RATES;

export function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Pick the applicable GST slab for a per-night post-discount amount.
 * Boundary: amounts ≤ ₹7,500 → 12%; amounts > ₹7,500 → 18%.
 */
export function pickSlabForPostDiscount(postDiscountAmount: number): GstSlab {
  if (postDiscountAmount <= 0) return '0%';
  return postDiscountAmount <= 7500 ? '12%' : '18%';
}

export function calculateGST(postDiscountAmount: number, slab: GstSlab) {
  const rate = GST_RATES[slab];
  if (rate === undefined) {
    throw new AppError('INVALID_GST_SLAB', 'GST slab must be one of: 0%, 12%, 18%', 400);
  }
  if (!Number.isFinite(postDiscountAmount) || postDiscountAmount < 0) {
    throw new AppError('INVALID_GST_AMOUNT', 'GST amount must be a non-negative number', 400);
  }

  const halfRate = rate / 2;
  const taxableAmount = roundTo2Decimals(postDiscountAmount);
  const cgst = roundTo2Decimals(taxableAmount * halfRate);
  const sgst = roundTo2Decimals(taxableAmount * halfRate);
  const total = roundTo2Decimals(taxableAmount + cgst + sgst);

  return { taxableAmount, cgst, sgst, total };
}
