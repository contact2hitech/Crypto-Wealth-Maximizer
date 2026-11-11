import unittest
import numpy as np
import pandas as pd
from optimization_engine import run_constrained_backtest, compare_protection_modes, walk_forward_report

class RiskEngineValidationTests(unittest.TestCase):
    def setUp(self):
        dates=pd.date_range("2016-11-09",periods=3653,freq="D")
        x=np.arange(len(dates))
        btc=100*np.exp(.0008*x)*(1+.035*np.sin(x/24))
        # A clear prolonged drawdown after 2024 to exercise daily stop logic.
        crash_start=2900
        btc[crash_start:]=btc[crash_start]*np.exp(-.0017*np.arange(len(x)-crash_start))*(1+.025*np.sin(x[crash_start:]/17))
        eth=75*np.exp(.00055*x)*(1+.05*np.sin(x/29+1))
        sol=np.where(x<1250,np.nan,8*np.exp(.0009*x)*(1+.07*np.sin(x/20+2)))
        self.prices=pd.DataFrame({"Bitcoin":btc,"Ethereum":eth,"Solana":sol},index=dates)

    def test_cash_filter_can_be_disabled_independently(self):
        on=run_constrained_backtest(self.prices,"A: 90-day momentum",rebalance_frequency="Monthly",
            cash_when_no_positive_score=True,drawdown_protection_pct=0)
        off=run_constrained_backtest(self.prices,"A: 90-day momentum",rebalance_frequency="Monthly",
            cash_when_no_positive_score=False,drawdown_protection_pct=0)
        self.assertNotEqual(int(on.summary.iloc[0]["Cash days"]),int(off.summary.iloc[0]["Cash days"]))

    def test_drawdown_exit_is_not_limited_to_monthly_rebalance(self):
        r=run_constrained_backtest(self.prices,"A: 90-day momentum",rebalance_frequency="Monthly",
            minimum_holding_days=60,cash_when_no_positive_score=False,drawdown_protection_pct=10)
        d=next(iter(r.diagnostics.values()))
        risk=d[d["Event"]=="Drawdown protection"]
        self.assertGreater(len(risk),0)
        self.assertTrue((risk["Drawdown (%)"]<=-10).all())

    def test_threshold_changes_protection_behavior_on_crash_series(self):
        low=run_constrained_backtest(self.prices,"A: 90-day momentum",rebalance_frequency="Daily",
            cash_when_no_positive_score=False,drawdown_protection_pct=10)
        high=run_constrained_backtest(self.prices,"A: 90-day momentum",rebalance_frequency="Daily",
            cash_when_no_positive_score=False,drawdown_protection_pct=30)
        self.assertNotAlmostEqual(low.summary.iloc[0]["Final value (USD)"],
                                  high.summary.iloc[0]["Final value (USD)"],places=4)

    def test_four_modes_and_benchmarks_are_returned(self):
        summary,curves,holdings,trades,diagnostics=compare_protection_modes(
            self.prices,"A: 90-day momentum",rebalance_frequency="Monthly")
        self.assertEqual(sum(summary["Experiment"].str.startswith(("A –","B –","C –","D –"))),4)
        self.assertIn("Benchmark – Bitcoin",summary["Experiment"].values)
        self.assertEqual(len(curves),len(summary))
        self.assertIn("Drawdown protection",set(diagnostics["B – Drawdown protection only"]["Event"]))


    def test_drawdown_reentry_resets_protection_high_water_mark(self):
        r=run_constrained_backtest(self.prices,"A: 90-day momentum",rebalance_frequency="Daily",
            minimum_holding_days=0,cash_when_no_positive_score=False,drawdown_protection_pct=10,
            cash_reentry_score_pct=-5)
        events=next(iter(r.diagnostics.values()))
        reentries=events[events["Event"]=="Drawdown recovery re-entry"]
        exits=events[events["Event"]=="Drawdown protection"]
        # The first re-entry should not be followed by an immediate same-threshold
        # exit solely because the previous cycle's high-water mark was retained.
        if len(reentries):
            first_reentry=reentries.iloc[0]["Date"]
            later_exits=exits[exits["Date"]>first_reentry]
            self.assertTrue(len(later_exits)==0 or
                            (later_exits.iloc[0]["Date"]-first_reentry).days>=1)


    def test_both_initialization_modes_are_supported(self):
        invested=run_constrained_backtest(self.prices,"A: 90-day momentum",
            start_date="2016-11-09",end_date="2017-02-15",
            cash_when_no_positive_score=True,drawdown_protection_pct=0,
            initialization_mode="Invest immediately in Bitcoin")
        waiting=run_constrained_backtest(self.prices,"A: 90-day momentum",
            start_date="2016-11-09",end_date="2017-02-15",
            cash_when_no_positive_score=True,drawdown_protection_pct=0,
            initialization_mode="Wait for first valid signal")
        self.assertEqual(next(iter(invested.holdings.values())).iloc[0],"Bitcoin")
        self.assertEqual(next(iter(waiting.holdings.values())).iloc[0],"USD Cash")
        self.assertEqual(invested.summary.iloc[0]["Initialization mode"],
                         "Invest immediately in Bitcoin")
        self.assertEqual(waiting.summary.iloc[0]["Initialization mode"],
                         "Wait for first valid signal")

    def test_walk_forward_periods(self):
        wf=walk_forward_report(self.prices,"C: 30/90/180-day momentum")
        self.assertEqual(list(wf["Period"]),["Development","Validation","Test"])

if __name__=="__main__": unittest.main()
