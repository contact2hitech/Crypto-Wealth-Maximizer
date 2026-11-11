import unittest
import pandas as pd
import numpy as np
from robustness_engine import classify_market_regimes, regime_performance, asset_attribution, protection_effectiveness

class RobustnessTests(unittest.TestCase):
    def setUp(self):
        idx = pd.date_range("2020-01-01", periods=260, freq="D")
        btc = pd.Series(np.linspace(100, 300, len(idx)), index=idx)
        self.prices = pd.DataFrame({"Bitcoin":btc, "Ethereum":btc*2, "Solana":btc*0.5}, index=idx)
        self.equity = pd.Series(np.linspace(1000, 1200, len(idx)), index=idx)
        self.holdings = pd.Series(["Bitcoin"]*100+["USD Cash"]*60+["Ethereum"]*100, index=idx)
    def test_regime_classification_has_warmup(self):
        result = classify_market_regimes(self.prices)
        self.assertEqual(result.iloc[0]["Market regime"], "Insufficient history")
        self.assertIn("Bull", set(result["Market regime"]))
    def test_regime_summary_and_asset_attribution(self):
        regimes = regime_performance(self.prices, self.equity, self.holdings)
        assets = asset_attribution(self.equity, self.holdings)
        self.assertEqual(int(regimes["Days"].sum()), len(self.equity))
        self.assertEqual(int(assets["Days held"].sum()), len(self.equity))
    def test_protection_overshoot_uses_configured_trigger(self):
        diag = pd.DataFrame([{"Date":"2020-01-01","Event":"Drawdown protection","Drawdown (%)":-35.0}])
        _, exits = protection_effectiveness(diag, 20)
        self.assertEqual(exits.iloc[0]["Overshoot beyond configured trigger (pp)"], 15.0)

if __name__ == "__main__":
    unittest.main()
