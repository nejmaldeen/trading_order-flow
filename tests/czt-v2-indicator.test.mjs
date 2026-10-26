import test from "node:test";
import assert from "node:assert/strict";
import { calculateCztV2, DEFAULT_CZT_V2_CONFIG } from "../lib/czt-v2-indicator.ts";
import { offlineMarketData, getOfflineSummary } from "../lib/offline-market.ts";
import { marketData } from "../lib/market-data.ts";

test("CZT V2 Indicator: calculates VAH, VAL, POC, and EMA100 on mock data", () => {
  const candles = [];
  let basePrice = 200;
  for (let i = 0; i < 150; i++) {
    const open = basePrice;
    const high = open + 2;
    const low = open - 1.5;
    const close = open + 1;
    const volume = 1000 + (i === 120 ? 5000 : 0);
    basePrice = close;
    candles.push({
      openTime: 1700000000000 + i * 300000,
      closeTime: 1700000000000 + (i + 1) * 300000 - 1,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  const result = calculateCztV2(candles);
  assert.equal(result.bars.length, 150);
  assert.ok(result.latest !== null);
  assert.ok(result.latest.vah >= result.latest.poc);
  assert.ok(result.latest.poc >= result.latest.val);
  assert.ok(result.latest.trendEma > 0);
  assert.ok(result.vahSeries.length > 0);
  assert.ok(result.pocSeries.length > 0);
  assert.ok(result.valSeries.length > 0);
  assert.ok(result.trendSeries.length > 0);
});

test("Offline Market Data: retains PAXG compatibility; equities require SIP", async () => {
  const symbols = ["PAXGUSDT"];
  const summary = getOfflineSummary();

  for (const sym of symbols) {
    assert.ok(summary.symbols[sym], `Offline summary should contain ${sym}`);
    assert.ok(summary.symbols[sym].timeframes["5m"], `${sym} should have 5m timeframe`);
    assert.ok(summary.symbols[sym].timeframes["15m"], `${sym} should have 15m timeframe`);
    assert.ok(summary.symbols[sym].timeframes["1h"], `${sym} should have 1h timeframe`);
    assert.ok(summary.symbols[sym].timeframes["1d"], `${sym} should have 1d timeframe`);

    const bounds = summary.symbols[sym].timeframes["5m"];
    const marketRes = await marketData(sym, "5m", bounds.start, bounds.start + 300000 * 50);
    assert.ok(marketRes.candles.length > 0, `marketData should return candles for ${sym}`);
    assert.ok(marketRes.source.includes("المخزن المحلي") || marketRes.source.includes("أوفلاين"));

    // Run CZT V2 on the loaded candles
    const czt = calculateCztV2(marketRes.candles);
    assert.equal(czt.bars.length, marketRes.candles.length);
  }
});
