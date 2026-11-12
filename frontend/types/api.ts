/**
 * TypeScript contracts mirroring the Phase 1 FastAPI Pydantic schemas.
 * Financial figures come exclusively from the Python backend.
 */

export type StrategyName =
  | "A: 90-day momentum"
  | "B: 50/200-day trend + momentum"
  | "C: 30/90/180-day momentum";

export type RebalanceFrequency = "Daily" | "Weekly" | "Every 15 days" | "Monthly";

export type InitializationMode =
  | "Invest immediately in Bitcoin"
  | "Wait for first valid signal";

export type AssetName = "Bitcoin" | "Ethereum" | "Solana";
export type HoldingName = AssetName | "USD Cash";

export interface DateRangeInfo {
  start_date: string;
  end_date: string;
  row_count: number;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail;
}

export interface DatasetHealthInfo {
  path_relative: string;
  row_count: number;
  duplicate_dates: number;
  start_date: string;
  end_date: string;
  assets_available: string[];
  missing_pre_launch_sol_days: number;
  last_modified_utc: string;
  valid: boolean;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  app_env: string;
  engine_source_of_truth: "python";
  python_version: string;
  timestamp_utc: string;
  dataset: DatasetHealthInfo;
}

export interface DailyAssetPoint {
  date: string;
  Bitcoin: number | null;
  Ethereum: number | null;
  Solana: number | null;
}

export interface CrossoverRow {
  date: string;
  pair: string;
  leader_after_crossover: string;
  index_spread_after_crossover: number;
}

export interface BuyAndHoldRow {
  asset: string;
  entry_date: string;
  last_price_date: string;
  final_value_usd: number;
  profit_usd: number;
  return_pct: number;
}

export interface MarketPricesResponse {
  date_range: DateRangeInfo;
  initial_capital: number;
  common_start_date: string | null;
  prices: DailyAssetPoint[];
  normalized_indices: DailyAssetPoint[];
  common_start_indices: DailyAssetPoint[];
  crossovers: CrossoverRow[];
  buy_and_hold: BuyAndHoldRow[];
  caveats: string[];
}

export interface LatestCloseSnapshot {
  as_of_date: string;
  Bitcoin: number | null;
  Ethereum: number | null;
  Solana: number | null;
}

export interface AssetQualityRow {
  asset: string;
  ticker: string;
  first_available_date: string | null;
  last_available_date: string | null;
  valid_observations: number;
  missing_observations: number;
  non_positive_prices: number;
  outliers_over_50pct: number;
}

export interface MarketSummaryResponse {
  date_range: DateRangeInfo;
  duplicate_dates: number;
  data_quality_status: "valid" | "warning";
  latest_closes: LatestCloseSnapshot;
  asset_quality: AssetQualityRow[];
  caveats: string[];
}

export interface ConstrainedConfigBase {
  strategy: StrategyName;
  initial_capital: number;
  start_date: string;
  end_date: string | null;
  rebalance_frequency: RebalanceFrequency;
  minimum_holding_days: number;
  switching_threshold_pct: number;
  fee_bps_per_switch: number;
  drawdown_protection_pct: number;
  cash_reentry_score_pct: number;
  initialization_mode: InitializationMode;
}

export interface ConstrainedBacktestRequest extends ConstrainedConfigBase {
  allow_cash: boolean;
  enable_cash_filter: boolean;
  enable_drawdown_protection: boolean;
  include_benchmarks: boolean;
  include_daily_trace: boolean;
}

export interface ProtectionCompareRequest extends ConstrainedConfigBase {
  include_curves: boolean;
  include_details: boolean;
}

export interface PracticalBacktestRequest {
  initial_capital: number;
  start_date: string;
  end_date: string | null;
  fee_bps_per_switch: number;
}

export interface HindsightOptimizerRequest {
  initial_capital: number;
  start_date: string;
  end_date: string | null;
  max_switches: number;
}

export interface ConstrainedSummaryRow {
  strategy: string;
  rebalance: string;
  minimum_hold_days: number;
  switch_threshold_pct: number;
  fee_per_switch_bps: number;
  cash_enabled: boolean;
  cash_filter: boolean;
  drawdown_protection_pct: number;
  initialization_mode: string;
  lifetime_max_drawdown_pct: number | null;
  final_value_usd: number | null;
  total_return_pct: number | null;
  cagr_pct: number | null;
  maximum_drawdown_pct: number | null;
  annualized_volatility_pct: number | null;
  sharpe_rf0: number | null;
  switches: number;
  cash_days: number;
}

export interface EquityPoint {
  date: string;
  value_usd: number | null;
  drawdown_pct: number | null;
  holding: string;
}

export interface BenchmarkPoint {
  date: string;
  value_usd: number | null;
  drawdown_pct: number | null;
}

export interface BenchmarkSummaryRow {
  strategy: string;
  final_value_usd: number | null;
  total_return_pct: number | null;
  cagr_pct: number | null;
  maximum_drawdown_pct: number | null;
  annualized_volatility_pct: number | null;
  sharpe_rf0: number | null;
  switches: number;
  cash_days: number;
}

export interface ConstrainedTradeRow {
  signal_date: string;
  signal_execution_date: string;
  from_asset: string;
  to_asset: string;
  reason: string | null;
  portfolio_value_after_fee_usd: number | null;
  peak_before_decision_usd: number | null;
  drawdown_at_decision_pct: number | null;
  best_asset: string | null;
  best_score_pct: number | null;
}

export interface DiagnosticEventRow {
  date: string;
  event: string | null;
  from_asset: string;
  to_asset: string;
  portfolio_value_usd: number | null;
  peak_portfolio_value_usd: number | null;
  drawdown_pct: number | null;
  best_asset: string | null;
  best_score_pct: number | null;
  scheduled_rebalance: boolean;
}

export interface DrawdownTraceRow {
  date: string;
  holding_during_interval: string;
  holding_before_decision: string;
  previous_close_portfolio_value_usd: number | null;
  portfolio_value_before_decision_usd: number | null;
  previous_high_water_mark_usd: number | null;
  high_water_mark_before_decision_usd: number | null;
  high_water_mark_updated_today: boolean;
  close_to_close_portfolio_return_pct: number | null;
  drawdown_before_decision_pct: number | null;
  protection_threshold_pct: number | null;
  drawdown_trigger_breached: boolean;
  scheduled_rebalance: boolean;
  decision: string;
  holding_after_decision: string;
  execution_assumption: string;
  fee_rate_bps: number;
}

export interface ConstrainedBacktestResponse {
  workflow: "constrained_backtest";
  warmup_mode: "evaluation_window_only";
  configuration: ConstrainedBacktestRequest;
  date_range: DateRangeInfo;
  summary: ConstrainedSummaryRow;
  equity_curve: EquityPoint[];
  benchmark_summaries: BenchmarkSummaryRow[];
  benchmark_curves: Record<string, BenchmarkPoint[]>;
  trades: ConstrainedTradeRow[];
  diagnostics: DiagnosticEventRow[];
  drawdown_trace: DrawdownTraceRow[] | null;
  assumptions_and_limitations: string[];
}

export interface ProtectionCompareRow {
  experiment: string;
  strategy: string;
  rebalance: string | null;
  minimum_hold_days: number | null;
  switch_threshold_pct: number | null;
  fee_per_switch_bps: number | null;
  cash_enabled: boolean | null;
  cash_filter: boolean | null;
  drawdown_protection_pct: number | null;
  initialization_mode: string | null;
  lifetime_max_drawdown_pct: number | null;
  final_value_usd: number | null;
  total_return_pct: number | null;
  cagr_pct: number | null;
  maximum_drawdown_pct: number | null;
  annualized_volatility_pct: number | null;
  sharpe_rf0: number | null;
  switches: number;
  cash_days: number;
}

export interface ProtectionCompareResponse {
  workflow: "protection_mode_comparison";
  warmup_mode: "evaluation_window_only";
  configuration: ProtectionCompareRequest;
  date_range: DateRangeInfo;
  comparison: ProtectionCompareRow[];
  curves: Record<string, BenchmarkPoint[]>;
  holdings_by_mode: Record<string, EquityPoint[]>;
  trades_by_mode: Record<string, ConstrainedTradeRow[]>;
  diagnostics_by_mode: Record<string, DiagnosticEventRow[]>;
  assumptions_and_limitations: string[];
}

export interface PracticalSummaryRow {
  strategy: string;
  final_value_usd: number | null;
  total_return_pct: number | null;
  cagr_pct: number | null;
  maximum_drawdown_pct: number | null;
  annualized_volatility_pct: number | null;
  sharpe_rf0_daily: number | null;
  switches: number;
}

export interface PracticalTradeRow {
  date: string;
  from_asset: string;
  to_asset: string;
}

export interface PracticalHoldingPoint {
  date: string;
  value_usd: number | null;
  drawdown_pct: number | null;
  holding: string | null;
}

export interface PracticalBacktestResponse {
  workflow: "practical_strategies";
  configuration: PracticalBacktestRequest;
  date_range: DateRangeInfo;
  summary: PracticalSummaryRow[];
  equity_curves: Record<string, PracticalHoldingPoint[]>;
  trades: Record<string, PracticalTradeRow[]>;
  assumptions_and_limitations: string[];
}

export interface HindsightSummaryRow {
  maximum_switches: number;
  actual_switches: number;
  final_value_usd: number;
  profit_usd: number;
  return_pct: number;
  ending_asset: string;
  maximum_drawdown_pct: number | null;
}

export interface HindsightSwitchEvent {
  date: string;
  switch_into: string;
}

export interface HindsightOptimizerResponse {
  workflow: "perfect_hindsight_optimizer";
  is_hindsight_upper_bound: true;
  is_investable: false;
  warning: string;
  configuration: HindsightOptimizerRequest;
  date_range: DateRangeInfo;
  summary: HindsightSummaryRow[];
  paths: Record<string, HindsightSwitchEvent[]>;
  equity_curves: Record<string, BenchmarkPoint[]>;
}

export interface RiskProtectionRequest extends ConstrainedConfigBase {
  allow_cash: boolean;
  enable_cash_filter: boolean;
  enable_drawdown_protection: boolean;
  include_daily_trace: boolean;
}

export interface EventCountSummary {
  event: string;
  events: number;
  mean_drawdown_pct: number | null;
  worst_drawdown_pct: number | null;
  median_drawdown_pct: number | null;
}

export interface DrawdownExitEvent {
  date: string;
  event: string;
  from_asset: string;
  to_asset: string;
  portfolio_value_usd: number | null;
  peak_portfolio_value_usd: number | null;
  drawdown_pct: number | null;
  best_asset: string | null;
  best_score_pct: number | null;
  scheduled_rebalance: boolean;
  overshoot_beyond_configured_trigger_pp: number | null;
}

export interface ExitMetricsSummary {
  total_drawdown_exits: number;
  average_exit_drawdown_pct: number | null;
  median_exit_drawdown_pct: number | null;
  worst_exit_drawdown_pct: number | null;
  worst_exit_date: string | null;
  average_overshoot_pp: number | null;
  max_overshoot_pp: number | null;
}

export interface RiskProtectionResponse {
  workflow: "risk_protection_analysis";
  warmup_mode: "evaluation_window_only";
  configuration: RiskProtectionRequest;
  date_range: DateRangeInfo;
  summary: ConstrainedSummaryRow;
  event_summary: EventCountSummary[];
  exit_metrics: ExitMetricsSummary;
  drawdown_exits: DrawdownExitEvent[];
  all_diagnostics: DiagnosticEventRow[];
  daily_trace: DrawdownTraceRow[] | null;
  execution_caveat: string;
  assumptions_and_limitations: string[];
}

export interface RobustnessAnalyzeRequest extends ConstrainedConfigBase {
  enable_cash_filter: boolean;
  enable_drawdown_protection: boolean;
  walk_forward_cash_filter: boolean | null;
  include_sensitivity: boolean;
}

export interface WalkForwardPeriodRow {
  period: string;
  start_date: string;
  end_date: string;
  strategy: string;
  final_value_usd: number | null;
  total_return_pct: number | null;
  cagr_pct: number | null;
  maximum_drawdown_pct: number | null;
  lifetime_max_drawdown_pct: number | null;
  annualized_volatility_pct: number | null;
  sharpe_rf0: number | null;
  switches: number;
  cash_days: number;
}

export interface WalkForwardSection {
  uses_full_canonical_dataset: true;
  is_independent_periods: true;
  note: string;
  periods: WalkForwardPeriodRow[];
}

export interface RegimePerformanceRow {
  market_regime: string;
  days: number;
  portfolio_return_in_regime_pct: number | null;
  average_daily_return_pct: number | null;
  positive_days_pct: number | null;
  cash_days: number;
}

export interface AssetAttributionRow {
  holding: string;
  days_held: number;
  exposure_pct: number | null;
  compounded_return_during_holding_days_pct: number | null;
  sum_of_daily_portfolio_returns_pct: number | null;
  positive_holding_days_pct: number | null;
}

export interface SensitivityRow {
  sensitivity_strategy: string;
  drawdown_trigger_pct: number;
  final_value_usd: number | null;
  total_return_pct: number | null;
  cagr_pct: number | null;
  maximum_drawdown_pct: number | null;
  annualized_volatility_pct: number | null;
  sharpe_rf0: number | null;
  switches: number;
  cash_days: number;
}

export interface RobustnessAnalyzeResponse {
  workflow: "robustness_analysis";
  configuration: RobustnessAnalyzeRequest;
  evaluation_date_range: DateRangeInfo;
  walk_forward: WalkForwardSection;
  market_regimes: RegimePerformanceRow[];
  asset_attribution: AssetAttributionRow[];
  protection_event_summary: EventCountSummary[];
  drawdown_exits: DrawdownExitEvent[];
  parameter_sensitivity: SensitivityRow[] | null;
  limitations: string[];
}

export interface ReportDocumentItem {
  id: "research_report" | "release_notes";
  title: string;
  source_filename: string;
  download_filename: string;
  download_path: string;
  content_markdown: string;
}

export interface CsvExportDescriptor {
  id: string;
  label: string;
  source_workflow: string;
}

export interface ReportsSummaryResponse {
  project_name: string;
  source_version: string;
  target_version: string;
  dataset_coverage: {
    path_relative: string;
    start_date: string;
    end_date: string;
    row_count: number;
    assets: string[];
  };
  reference_configuration: Record<string, unknown>;
  documents: ReportDocumentItem[];
  supported_csv_exports: CsvExportDescriptor[];
  limitations: string[];
}

