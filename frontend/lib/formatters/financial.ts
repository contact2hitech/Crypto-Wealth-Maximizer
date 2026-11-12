/**
 * Null-safe financial formatting utilities.
 * Never fabricate placeholder numbers; return "—" when a value is null or non-finite.
 */

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatUsd(
  value: number | null | undefined,
  decimals = 2
): string {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  decimals = 2,
  includePlusSign = false
): string {
  if (!isFiniteNumber(value)) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  if (includePlusSign && value > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

export function formatRatio(
  value: number | null | undefined,
  decimals = 2
): string {
  if (!isFiniteNumber(value)) return "—";
  return value.toFixed(decimals);
}

export function formatInteger(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export function getTrendTone(
  value: number | null | undefined
): "positive" | "negative" | "neutral" {
  if (!isFiniteNumber(value) || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

