export function formatCompactUsdAxis(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

export function formatCompactIndexAxis(value: number): string {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

export function formatAxisDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return dateStr;
  return dateStr.slice(0, 7);
}

/**
 * Converts a UTC date string ("YYYY-MM-DD") to an epoch millisecond timestamp
 * for linear time-scale charts.
 */
export function dateToUtcTimestamp(dateStr: string): number {
  return Date.parse(`${dateStr}T00:00:00Z`);
}

/**
 * Formats a numeric UTC timestamp for XAxis ticks as "YYYY-MM" (or "YYYY").
 */
export function formatAxisTimestamp(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    const d = new Date(value);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  return formatAxisDate(String(value ?? ""));
}

/**
 * Formats a numeric UTC timestamp for tooltips as "YYYY-MM-DD".
 */
export function formatTooltipTimestamp(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    const d = new Date(value);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value ?? "");
}


