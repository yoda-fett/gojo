const K = 1_000;
const L = 100_000;
const CR = 10_000_000;
const INF_THRESHOLD = 99.99 * CR; // 999,900,000

function trim(value: number) {
  return value.toFixed(2);
}

/**
 * Compact percentage formatter with Indian magnitude suffixes.
 * - <1000% → 1 decimal
 * - 1k–<1L → "X.YYk%"
 * - 1L–<1Cr → "X.YYL%"
 * - 1Cr–99.99Cr → "X.YYCr%"
 * - >99.99Cr → "Inf%"
 *
 * Pass `decimals` to override the small-value precision (defaults to 1).
 */
export function formatPercentValue(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return 'Inf%';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs > INF_THRESHOLD) return `${sign}Inf%`;
  if (abs >= CR) return `${sign}${trim(abs / CR)}Cr%`;
  if (abs >= L) return `${sign}${trim(abs / L)}L%`;
  if (abs >= K) return `${sign}${trim(abs / K)}k%`;
  return `${value.toFixed(decimals)}%`;
}

/**
 * Compact number formatter using Indian magnitude suffixes.
 * - <10,000 → grouped en-IN string (e.g., "9,999")
 * - 10k–<1L → "X.YYk"
 * - 1L–<1Cr → "X.YYL"
 * - ≥1Cr → "X.YYCr"
 */
export function formatNumberCompact(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < 10_000) return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  if (abs < 100_000) return `${sign}${(abs / 1000).toFixed(2)}k`;
  if (abs < 10_000_000) return `${sign}${(abs / 100_000).toFixed(2)}L`;
  return `${sign}${(abs / 10_000_000).toFixed(2)}Cr`;
}

/** Same as formatNumberCompact, prefixed with the rupee symbol. */
export function formatInr(value: number): string {
  return `₹${formatNumberCompact(value)}`;
}
