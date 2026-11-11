# Crypto Wealth Maximizer v1.0

Historical cryptocurrency strategy research and backtesting for Bitcoin, Ethereum, Solana and USD cash.

> **Research software only.** Historical results are hypothetical and are not investment advice or a promise of future performance. The application does not execute trades.

## Features
- Daily historical price exploration and normalized comparisons.
- Buy-and-hold benchmarks and a clearly labelled perfect-hindsight upper-bound experiment.
- Practical momentum/trend strategies that do not use future price knowledge.
- Constrained backtesting with rebalancing, minimum holding periods, switching thresholds and transaction costs.
- Cash filter and drawdown protection, including both initialization modes.
- Walk-forward validation with independent Development, Validation and Test periods.
- Daily drawdown execution trace.
- Market regime, exposure, protection-event and parameter-sensitivity analysis.
- CSV exports and final research report.

## Requirements
- Python 3.10 or later (tested in the project workflow with Python 3.13.9).
- Windows, macOS or Linux.
- Dependencies listed in `requirements.txt`.

## Installation

### Windows PowerShell
```powershell
py -3.13 -m venv venv
.env\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### macOS / Linux
```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## Run
From the project root (the folder containing `app.py`):

```bash
streamlit run app.py
```

Open the Local URL printed by Streamlit, normally `http://localhost:8501`.

## Test
```bash
python -m unittest discover -s tests -v
```

## Data
The cleaned historical dataset is stored at `data/crypto_daily_prices.csv`. Solana has a later first available date than Bitcoin and Ethereum. Missing pre-launch prices are not filled with invented values.

See `DATA_SOURCES.md` for source and data notes.

## Recommended research workflow
1. Review data quality and asset comparisons.
2. Compare practical strategies without future knowledge.
3. Configure the risk/protection lab.
4. Compare the four protection modes and buy-and-hold benchmarks.
5. Review walk-forward results, keeping the independent-period caveat in mind.
6. Inspect the Section 10 robustness outputs and export CSV files.
7. Read `FINAL_RESEARCH_REPORT.md` before presenting results.

## Important interpretation notes
- Walk-forward periods start with fresh capital; they do not form a continuous account.
- Daily-close drawdown protection is not an intraday stop-loss and does not guarantee a maximum loss equal to its threshold.
- Same-close execution is a simplifying assumption. Real execution can differ due to gaps, liquidity, spreads, slippage and fees.
- Regime-conditioned compounded returns combine non-contiguous days and are not independent investment periods.
- Exposure attribution is descriptive; returns during asset-holding days are not a complete causal decomposition of asset profit.
- Perfect-hindsight optimization uses future knowledge and is an upper-bound illustration, not a usable signal.
- Strong historical development results do not establish future profitability. The reviewed Test period was negative.

## Project documents
- `FINAL_RESEARCH_REPORT.md` — consolidated findings and limitations.
- `RELEASE_NOTES_V1.0.md` — v1.0 scope.
- `PHASE4_4_RELEASE_NOTES.md` — Phase 4.4 details.
- `PHASE4_3_RELEASE_NOTES.md` — initialization-mode changes.
- `DATA_SOURCES.md` — dataset provenance and notes.

## License
Review and add an appropriate license before publishing publicly. Do not imply that the project is licensed for reuse until a license file is selected.
