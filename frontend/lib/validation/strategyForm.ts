/**
 * Shared validation logic for Strategy Lab and Risk Lab forms.
 *
 * Enforces date consistency, capital constraints, and risk parameter bounds.
 */

export interface StrategyFormValidationInput {
  startDate: string;
  endDate: string;
  initialCapital: number;
}

export interface RiskFormValidationInput {
  startDate: string;
  endDate: string;
  drawdownProtectionPct: number;
}

/**
 * Validates Strategy Lab form inputs.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateStrategyFormInput(input: StrategyFormValidationInput): string | null {
  const { startDate, endDate, initialCapital } = input;

  if (!startDate || !endDate) {
    return "Start date and end date are required.";
  }

  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "Invalid date format. Expected YYYY-MM-DD.";
  }

  if (startMs > endMs) {
    return "Start date must be earlier than or equal to end date.";
  }

  if (typeof initialCapital !== "number" || Number.isNaN(initialCapital) || initialCapital <= 0) {
    return "Initial capital must be a positive number.";
  }

  return null;
}

/**
 * Validates Risk Lab form inputs.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateRiskFormInput(input: RiskFormValidationInput): string | null {
  const { startDate, endDate, drawdownProtectionPct } = input;

  if (!startDate || !endDate) {
    return "Start date and end date are required.";
  }

  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "Invalid date format. Expected YYYY-MM-DD.";
  }

  if (startMs > endMs) {
    return "Start date must be earlier than or equal to end date.";
  }

  if (
    typeof drawdownProtectionPct !== "number" ||
    Number.isNaN(drawdownProtectionPct) ||
    drawdownProtectionPct <= 0 ||
    drawdownProtectionPct > 100
  ) {
    return "Drawdown protection threshold must be between 1% and 100%.";
  }

  return null;
}

/**
 * Accurately compute exit gap overshoot in percentage points beyond configured trigger.
 * e.g., if configured stop is 20% and exit drawdown is -24.02%, overshoot is 4.02 pp.
 */
export function calculateExitOvershoot(exitDrawdownPct: number, configuredTriggerPct: number): number {
  const actualAbsDd = Math.abs(exitDrawdownPct);
  const triggerAbs = Math.abs(configuredTriggerPct);
  if (actualAbsDd <= triggerAbs) return 0;
  return Number((actualAbsDd - triggerAbs).toFixed(4));
}

/**
 * Academic verification: Checks that hindsight response strictly satisfies
 * theoretical non-investable upper bound constraints.
 */
export function isHindsightNonInvestable(
  isHindsightUpperBound: boolean | undefined,
  isInvestable: boolean | undefined,
  warning: string | undefined
): boolean {
  if (isHindsightUpperBound !== true) return false;
  if (isInvestable !== false) return false;
  if (!warning || !warning.toLowerCase().includes("non-investable")) return false;
  return true;
}

