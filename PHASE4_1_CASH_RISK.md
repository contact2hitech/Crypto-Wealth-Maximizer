# Phase 4.1 – Cash Allocation and Risk Protection

## Features
- Optional 100% USD cash allocation.
- Cash filter: move to cash when no asset has a positive strategy score.
- Portfolio drawdown protection: trigger cash exit when drawdown from the running portfolio peak reaches a configured threshold.
- Cash re-entry requires the best available strategy score to meet a configurable threshold.
- Drawdown exits bypass minimum holding-period restrictions.
- Flat transaction cost is charged when changing holdings.
- Daily holdings and switch history can be exported.

## Corrected walk-forward design
The indicator score matrix is computed from the full historical price series up to each evaluation period's end. For each period, prices before its start are supplied as indicator warm-up; portfolio capital is reset at the period start. Thus validation/test indicators can use preceding observations without using any future data.

## Timing
At close t, the model observes prices and portfolio drawdown, then chooses the next holding. The selected holding earns the next close-to-close return. USD cash is assumed to earn 0%; this omits interest on cash and stablecoin yield. A switch fee is charged at the execution close.

## Important limitations
- Drawdown protection triggers only at scheduled rebalance dates, except the close-by-close drawdown state is updated daily; the action occurs on the next eligible rebalance date.
- The portfolio starts each independent walk-forward segment in Bitcoin; earlier prices are used only for indicator warm-up. This is a clean independent-period test, not a continuous funded account across segments.
- Missing selected-asset daily returns are treated as zero. Data gaps should be reviewed.
- USD cash is a theoretical cash position, not a stablecoin. FX conversion, bank/custody, tax, spreads and market impact are not modeled.
- Historical results are research simulations, not investment advice.
