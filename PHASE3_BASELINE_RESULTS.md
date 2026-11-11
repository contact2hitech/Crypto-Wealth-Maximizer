# Phase 3 baseline results (provisional)

Dataset: reconciled daily USD closes, 2016-11-09 through 2026-11-09.
Initial capital: $1,480. Transaction costs: 0 bps per switch.

The strategies are no-lookahead in timing: a signal computed at close t is
applied to the following close-to-close return. They are still idealized:
daily close execution, no slippage, spread, taxes, market impact or custody risk.

## Results

                      Strategy  Final value (USD)  Total return (%)   CAGR (%)  Maximum drawdown (%)  Annualized volatility (%)  Sharpe (rf=0, daily)  Switches
           Buy & hold: Bitcoin       1.524387e+05      10199.909950  58.968436            -83.399009                  66.832968              1.029344         0
            A: 90-day momentum       5.217235e+06     352415.884589 126.342670            -91.086144                  97.980683              1.318628       180
B: 50/200-day trend + momentum       3.020332e+06     203976.511404 114.301207            -93.128573                  90.208069              1.296707       103
     C: 30/90/180-day momentum       7.396800e+05      49878.380326  86.172344            -88.632537                  91.197210              1.137254       113

## Interpretation

The 90-day momentum rule produced the largest result among the three simple
rules in this in-sample period, but it made 180 switches and suffered a very
large drawdown. This is not a recommendation. Results are highly dependent on
the historical period and the mixed-source ETH price series. The next work is
walk-forward/out-of-sample testing, sensitivity analysis, transaction-cost
stress testing, and independent price-source validation.

A high CAGR with a 90%+ maximum drawdown is not a low-risk strategy.
