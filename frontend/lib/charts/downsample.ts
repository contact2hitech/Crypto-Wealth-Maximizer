/**
 * Extrema-preserving chart series downsampler for responsive SVG rendering.
 * Never alters backend KPIs or summary tables; preserves first/last points,
 * series-onset transitions (e.g., Solana launch), and per-bucket min/max extrema.
 */
export function downsampleByExtrema<T>(
  items: readonly T[],
  maxPoints: number,
  getSeriesValues: (item: T) => Array<number | null | undefined>
): T[] {
  if (items.length <= maxPoints || maxPoints < 4) {
    return [...items];
  }

  const keep = new Set<number>([0, items.length - 1]);

  // Preserve the first valid observation index for every series (e.g., SOL on 2020-04-10)
  // and the last valid observation index before any null trailing gap.
  const firstSample = getSeriesValues(items[0]);
  const seriesCount = firstSample.length;
  for (let s = 0; s < seriesCount; s += 1) {
    for (let i = 0; i < items.length; i += 1) {
      const val = getSeriesValues(items[i])[s];
      if (typeof val === "number" && Number.isFinite(val)) {
        keep.add(i);
        if (i > 0) keep.add(i - 1);
        break;
      }
    }
  }

  const interiorLength = items.length - 2;
  const bucketCount = Math.max(1, Math.floor((maxPoints - keep.size) / 2));
  const bucketSize = interiorLength / bucketCount;

  for (let b = 0; b < bucketCount; b += 1) {
    const start = 1 + Math.floor(b * bucketSize);
    const end = Math.min(items.length - 1, 1 + Math.floor((b + 1) * bucketSize));
    if (start >= end) continue;

    let minIdx = start;
    let maxIdx = start;
    let minVal = Number.POSITIVE_INFINITY;
    let maxVal = Number.NEGATIVE_INFINITY;

    for (let i = start; i < end; i += 1) {
      const vals = getSeriesValues(items[i]);
      for (const raw of vals) {
        if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
        if (raw < minVal) {
          minVal = raw;
          minIdx = i;
        }
        if (raw > maxVal) {
          maxVal = raw;
          maxIdx = i;
        }
      }
    }

    keep.add(minIdx);
    keep.add(maxIdx);
  }

  return Array.from(keep)
    .sort((a, b) => a - b)
    .map((idx) => items[idx]);
}

