/**
 * Outlier-removal helpers (PRD §3.6).
 *
 * FOUNDATION ONLY: pure statistical helpers used by the analytics phase to
 * strip "9999 mirror" style fake listings and compute robust price stats.
 * The full pipeline (seller-dedup penalty, currency-aware filtering, stale
 * listing removal) is wired up in a later phase on top of these.
 */

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/** Inter-quartile-range bounds; values outside [lower, upper] are outliers. */
export function iqrBounds(values: number[], k = 1.5): { lower: number; upper: number } | null {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  if (q1 === null || q3 === null) return null;
  const iqr = q3 - q1;
  return { lower: q1 - k * iqr, upper: q3 + k * iqr };
}

export function zScores(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

/**
 * Partition prices into valid vs outlier indices using IQR (default).
 * Returns the boolean flag per input index (true = outlier).
 */
export function flagOutliers(values: number[], k = 1.5): boolean[] {
  const bounds = iqrBounds(values, k);
  if (!bounds) return values.map(() => false);
  return values.map((v) => v < bounds.lower || v > bounds.upper);
}
