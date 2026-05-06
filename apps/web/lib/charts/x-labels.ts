import { buildRange, type DateRange, type RangePreset } from '@/lib/dashboard/date-range';

const PRESETS: RangePreset[] = ['today', 'yesterday', '7d', '30d', '90d', 'mtd', 'ytd'];

export function detectPreset(range: DateRange): RangePreset | 'custom' {
  for (const key of PRESETS) {
    const r = buildRange(key);
    if (r.from === range.from && r.to === range.to) return key;
  }
  return 'custom';
}

/**
 * Returns the x-axis label rules for a chart over the given range.
 * - 7D → label every 1 point
 * - 30D → label every 5 points
 * - 90D → label every 15 points
 * - MTD/YTD/Custom → 6 evenly spaced labels
 */
export function chartXLabelControls(range: DateRange): { xLabelStep?: number; xLabelCount?: number } {
  switch (detectPreset(range)) {
    case '7d':
      return { xLabelStep: 1 };
    case '30d':
      return { xLabelStep: 5 };
    case '90d':
      return { xLabelStep: 15 };
    default:
      return { xLabelCount: 6 };
  }
}
