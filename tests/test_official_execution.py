"""Independent hand-calculated oracle for the stream parser and sparse-minute rule."""
import datetime as dt
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

path = Path(__file__).parents[1] / "scripts/audit-binance-official-reconciliation.py"
spec = importlib.util.spec_from_file_location("execution_audit", path)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class ExecutionOracle(unittest.TestCase):
    def run_fixture(self, missing=False):
        day = "2017-08-19"
        start = int(dt.datetime(2017, 8, 19, tzinfo=dt.timezone.utc).timestamp()) * 1000
        minute = start + 60 * 60000
        trades = [f"10,2,3,6,{minute},False,True", f"11,5,2,10,{minute+1},True,True"]
        aggregates = [f"20,2,3,10,10,{minute},False,True", f"21,5,2,11,11,{minute+1},True,True"]
        klines = []
        for index in range(1440):
            t = start + index * 60000
            active = t == minute
            klines.append(f"{t},2,{5 if active else 2},2,{5 if active else 2},{5 if active else 0},{t+59999},{16 if active else 0},{2 if active else 0},{3 if active else 0},{6 if active else 0},0")
        with tempfile.TemporaryDirectory() as directory:
            sources = {}
            for name, rows in [("trades", [] if missing else trades), ("aggTrades", aggregates), ("klines", klines)]:
                # Keep a different occupied minute in the negative case.
                if name == "trades" and missing:
                    rows = [f"10,2,3,6,{start},False,True"]
                archive = Path(directory) / (name + ".zip")
                with ZipFile(archive, "w") as z:
                    z.writestr("fixture.csv", "\n".join(rows))
                sources[name] = (archive, {})
            with patch.object(audit, "source", side_effect=lambda kind, _: sources[kind]):
                return audit.audit(day)

    def test_hand_oracle(self):
        result = self.run_fixture()
        self.assertEqual(result["issues"], {})
        self.assertEqual(result["emptyKlines"], 1439)
        self.assertEqual([result[k] for k in ("totalExecutedVolume","takerBuyVolume","takerSellVolume","finalCVD","footprint5minVolume")], ["5","3","2","1","5"])
        self.assertEqual(result["footprint5minCells"], 2)
        self.assertEqual([result["volumeProfile"][k] for k in ("POC","VAL","VAH")], ["2","2","5"])

    def test_missing_positive_minute_fails(self):
        self.assertEqual(self.run_fixture(True)["issues"]["trades.minutePresent"], 2)

if __name__ == "__main__":
    unittest.main()
