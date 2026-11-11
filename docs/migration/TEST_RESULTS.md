# Test Results — Crypto Wealth Maximizer v2.0 Migration

All results below were directly executed and observed in the local environment (`Windows`, `Python 3.13.9` via `.\venv\Scripts\python.exe`, `pandas 3.1.1`, `numpy 2.5.4`, `Node v24.14.1`, `npm 11.11.0`) on `2026-11-11`.

---

## Phase 0 Baseline Verification (Commit base `6b1a6f9` / branch `v2.0-nextjs-migration`)

### 1. Existing Unit Test Suite (`unittest`)
Command:
```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```
Result: **PASS (`26 / 26` tests in `71.734s`, `OK`)**

Breakdown by file:
- `tests/test_cash_risk_protection.py` — 4/4 `ok` (`test_cash_is_an_available_holding`, `test_drawdown_protection_can_trigger_cash`, `test_fees_do_not_improve_result`, `test_walk_forward_uses_prior_indicator_history`)
- `tests/test_drawdown_trace.py` — 2/2 `ok` (`test_compare_exports_trace_for_each_protection_mode`, `test_trace_has_one_row_per_day_and_exposes_gap_overshoot`)
- `tests/test_engine.py` — 3/3 `ok` (`test_equity_curve_ends_at_optimizer_final_value`, `test_sol_cannot_be_used_before_first_price`, `test_zero_switches_stays_in_bitcoin`)
- `tests/test_optimization_lab.py` — 3/3 `ok` (`test_fees_do_not_increase_final_value`, `test_frequency_and_minimum_hold`, `test_walk_forward_has_three_periods`)
- `tests/test_optimizer_exhaustive.py` — 1/1 `ok` (`test_dynamic_programming_matches_brute_force`)
- `tests/test_practical_strategies.py` — 3/3 `ok` (`test_costs_do_not_improve_result`, `test_no_future_holding_signal`, `test_returns_all_three_strategies`)
- `tests/test_risk_engine_validation.py` — 7/7 `ok` (`test_both_initialization_modes_are_supported`, `test_cash_filter_can_be_disabled_independently`, `test_drawdown_exit_is_not_limited_to_monthly_rebalance`, `test_drawdown_reentry_resets_protection_high_water_mark`, `test_four_modes_and_benchmarks_are_returned`, `test_threshold_changes_protection_behavior_on_crash_series`, `test_walk_forward_periods`)
- `tests/test_robustness_engine.py` — 3/3 `ok` (`test_protection_overshoot_uses_configured_trigger`, `test_regime_classification_has_warmup`, `test_regime_summary_and_asset_attribution`)

### 2. Data Integrity Audit (`validate_data.py`)
Command:
```powershell
.\venv\Scripts\python.exe validate_data.py
```
Result: **PASS (exit code 0)**
- Rows: `3,653` (`2016-11-09` to `2026-11-09`), duplicate date rows: `0`
- `Bitcoin`: `3,653` valid, `0` missing, `0` non-positive, `0` >50% daily return outliers (`2016-11-09` to `2026-11-09`)
- `Ethereum`: `3,653` valid, `0` missing, `0` non-positive, `0` >50% daily return outliers (`2016-11-09` to `2026-11-09`)
- `Solana`: `2,405` valid, `1,248` missing, `0` non-positive, `0` >50% daily return outliers (`2020-04-10` to `2026-11-09`)

### 3. Perfect-Hindsight Optimizer Audit (`validate_optimizer.py`)
Command:
```powershell
.\venv\Scripts\python.exe validate_optimizer.py
```
Result: **PASS (exit code 0)**
- `0` max switches (`0` used): `$152,438.67`, max drawdown `-83.40%` — PASS
- `1` max switches (`1` used): `$3,584,419.51`, max drawdown `-96.27%` — PASS
- `2` max switches (`2` used): `$14,497,949.68`, max drawdown `-96.27%` — PASS
- `3` max switches (`3` used): `$69,799,688.05`, max drawdown `-96.27%` — PASS
- `4` max switches (`4` used): `$251,877,785.48`, max drawdown `-83.40%` — PASS
- `5` max switches (`5` used): `$552,814,299.71`, max drawdown `-83.40%` — PASS
- `6` max switches (`6` used): `$1,815,458,562.13`, max drawdown `-83.40%` — PASS
- `7` max switches (`7` used): `$3,984,517,537.97`, max drawdown `-83.40%` — PASS
- `8` max switches (`8` used): `$10,097,456,935.34`, max drawdown `-83.40%` — PASS
- `9` max switches (`9` used): `$18,561,778,105.79`, max drawdown `-76.63%` — PASS
- `10` max switches (`10` used): `$47,038,757,711.69`, max drawdown `-76.63%` — PASS

### 4. Baseline Regression Reference Reconciliation
Executed directly against `data/crypto_daily_prices.csv`:

1. **Practical Strategies (`run_practical_strategies`, `$1,480`, `2016-11-09` to `2026-11-10`, `0 bps`)** — matches `practical_strategy_baseline.csv`:
   - `Buy & hold: Bitcoin`: `$152,438.67` (`10,199.91%`, CAGR `58.97%`, max DD `-83.40%`, Sharpe `1.03`, `0` switches)
   - `A: 90-day momentum`: `$5,217,235.09` (`352,415.88%`, CAGR `126.34%`, max DD `-91.09%`, Sharpe `1.32`, `180` switches)
   - `B: 50/200-day trend + momentum`: `$3,020,332.37` (`203,976.51%`, CAGR `114.30%`, max DD `-93.13%`, Sharpe `1.30`, `103` switches)
   - `C: 30/90/180-day momentum`: `$739,680.03` (`49,878.38%`, CAGR `86.17%`, max DD `-88.63%`, Sharpe `1.14`, `113` switches)

2. **Protection Mode Comparison (`compare_protection_modes`, reference Strategy A, `$1,480`, `Monthly`, `30` days hold, `10%` threshold, `10 bps`, `20%` DD, `0%` recovery)** — matches `FINAL_RESEARCH_REPORT.md`:
   - `Invest immediately in Bitcoin` -> `C – Combined protection`: `$585,970.46`, `39,492.60%` total return, `81.89%` CAGR, `-69.94%` max DD, `68.43%` volatility, `1.21` Sharpe, `95` switches, `1,830` cash days.
   - `Wait for first valid signal` -> `C – Combined protection`: `$470,228.80`, `31,672.21%` total return, `77.93%` CAGR, `-69.94%` max DD, `68.01%` volatility, `1.18` Sharpe, `94` switches, `1,888` cash days; `39` drawdown exits (mean `-24.07%`, median `-22.74%`, min `-40.26%`).
   - `Wait for first valid signal` Walk-Forward (`walk_forward_report`):
     - `Development`: `$223,912.42` (`126.44%` CAGR, `-69.94%` max DD, `1.45` Sharpe, `61` switches, `1,247` cash days)
     - `Validation`: `$4,900.90` (`82.05%` CAGR, `-41.31%` max DD, `1.27` Sharpe, `21` switches, `260` cash days)
     - `Test`: `$938.60` (`-21.74%` CAGR, `-52.02%` max DD, `-0.46` Sharpe, `12` switches, `381` cash days)
