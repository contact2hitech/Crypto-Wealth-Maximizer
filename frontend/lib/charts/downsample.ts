/**
 * Extrema-preserving multi-series chart downsampler for responsive SVG rendering.
 * Never alters backend KPIs or summary tables.
 *
 * Guarantees:
 * 1. The requested maxPoints budget is enforced during normal operation.
 * 2. The first and last observations are preserved.
 * 3. The first valid observation of each series and its preceding null boundary are preserved.
 * 4. Independent minimum and maximum extrema are preserved for every series within each bucket
 *    (preventing cross-series scale occlusion where a high-scale series masks a lower-scale asset).
 * 5. If mandatory boundary points alone exceed the requested budget, all mandatory points are retained.
 * 6. This mandatory-boundary overflow is an intentional exception, not an algorithm failure.
 *
 * Validation:
 * @throws {RangeError} If maxPoints is not a positive integer (<= 0, non-integer, or non-finite).
 */
export function downsampleByExtrema<T>(
  items: readonly T[],
  maxPoints: number,
  getSeriesValues: (item: T) => Array<number | null | undefined>
): T[] {
  if (!Number.isInteger(maxPoints) || maxPoints <= 0) {
    throw new RangeError(
      `maxPoints must be a positive integer, received: ${maxPoints}`
    );
  }

  if (items.length <= maxPoints) {
    return [...items];
  }

  const mandatoryIndices = new Set<number>([0, items.length - 1]);

  // Determine series count from first sample with series values
  const firstSample = items.length > 0 ? getSeriesValues(items[0]) : [];
  const seriesCount = Array.isArray(firstSample) ? firstSample.length : 0;

  // Preserve the first valid observation index for every series (e.g., SOL on 2020-04-10)
  // and the immediately preceding null observation at series onset.
  for (let s = 0; s < seriesCount; s += 1) {
    for (let i = 0; i < items.length; i += 1) {
      const val = getSeriesValues(items[i])[s];
      if (typeof val === "number" && Number.isFinite(val)) {
        mandatoryIndices.add(i);
        if (i > 0) {
          mandatoryIndices.add(i - 1);
        }
        break;
      }
    }
  }

  // Mandatory-boundary overflow exception:
  // If mandatory boundary points alone exceed or meet the requested budget, retain all mandatory points.
  // This is an intentional exception, not an algorithm failure.
  if (mandatoryIndices.size >= maxPoints) {
    return Array.from(mandatoryIndices)
      .sort((a, b) => a - b)
      .map((idx) => items[idx]);
  }

  const keep = new Set<number>(mandatoryIndices);
  const availableForExtrema = maxPoints - keep.size;
  const pointsPerBucket = Math.max(1, 2 * seriesCount);
  const bucketCount = Math.min(
    items.length - 2,
    Math.floor(availableForExtrema / pointsPerBucket)
  );

  if (bucketCount <= 0) {
    return Array.from(keep)
      .sort((a, b) => a - b)
      .map((idx) => items[idx]);
  }

  const interiorLength = items.length - 2;
  const bucketSize = interiorLength / bucketCount;

  for (let b = 0; b < bucketCount; b += 1) {
    const start = 1 + Math.floor(b * bucketSize);
    const end = Math.min(items.length - 1, 1 + Math.floor((b + 1) * bucketSize));
    if (start >= end) continue;

    // Track min and max INDEPENDENTLY for every series to prevent scale occlusion
    for (let s = 0; s < seriesCount; s += 1) {
      let sMinIdx = -1;
      let sMaxIdx = -1;
      let sMinVal = Number.POSITIVE_INFINITY;
      let sMaxVal = Number.NEGATIVE_INFINITY;

      for (let i = start; i < end; i += 1) {
        const raw = getSeriesValues(items[i])[s];
        if (typeof raw !== "number" || !Number.isFinite(raw)) continue;

        if (raw < sMinVal) {
          sMinVal = raw;
          sMinIdx = i;
        }
        if (raw > sMaxVal) {
          sMaxVal = raw;
          sMaxIdx = i;
        }
      }

      if (sMinIdx !== -1) {
        keep.add(sMinIdx);
      }
      if (sMaxIdx !== -1) {
        keep.add(sMaxIdx);
      }
    }
  }

  return Array.from(keep)
    .sort((a, b) => a - b)
    .map((idx) => items[idx]);
}


