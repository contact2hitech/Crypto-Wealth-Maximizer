# Historical data source plan

## Primary and cross-check sources

- Yahoo Finance (`BTC-USD`, `ETH-USD`, `SOL-USD`) is the current app's convenience source through `yfinance`.
- CoinGecko documents historical market data reaching back 10+ years, subject to asset and plan availability: https://support.coingecko.com/articles/7171295369-how-far-back-is-the-historical-data
- Aethereal publishes a daily USD OHLCV dataset for BTC, ETH, SOL and other assets, with a downloadable CSV and stated coverage from 2014-09-17 through 2026-11-09: https://dataset.aethereal.top/datasets/crypto-prices
- CryptoDataDownload provides exchange-specific historical OHLCV CSVs; coverage depends on exchange and pair: https://www.cryptodatadownload.com/data/

## Important source caveats

1. A ticker's first date in Yahoo Finance is not necessarily the asset's launch date. The current screenshot's ETH start of 2017-11-09 is a provider-history limitation and must be cross-checked, not treated as Ethereum's actual first trading date.
2. SOL did not exist in 2016. Keep SOL missing before its genuine first market observation; never backfill a synthetic price.
3. Different sources may use exchange-specific closes, UTC boundaries, aggregated market prices, or different daily cutoffs. Record the source and timestamp convention before combining them.
4. Do not merge sources silently. Prefer one consistent primary dataset for the actual backtest, then use another source to check selected dates and large discrepancies.
5. Check licences and attribution before redistributing downloaded datasets with a public application.

## Current dataset status

The app currently downloads Yahoo Finance daily closes. The research result is provisional until the user supplies or selects a longer-history source and the audit report has been reviewed.
