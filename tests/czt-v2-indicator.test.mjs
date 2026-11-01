import test from "node:test";
import assert from "node:assert/strict";
import { calculateCztV2, DEFAULT_CZT_V2_CONFIG } from "../lib/czt-v2-indicator.ts";
import { offlineMarketData, getOfflineSummary } from "../lib/offline-market.ts";
import { marketData } from "../lib/market-data.ts";
import { generateInstitutionalSnapshot } from '../lib/institutional-hub.ts';

test('illustrative radar is deterministic in replay and uses the previous trading day across weekends',()=>{
  const candle=(date,high)=>({openTime:Date.parse(date+'T13:30:00Z'),closeTime:Date.parse(date+'T13:31:00Z')-1,open:100,high,low:99,close:101,volume:10});
  const candles=[candle('2026-09-04',110),candle('2026-09-08',102)];
  const a=generateInstitutionalSnapshot(candles),b=generateInstitutionalSnapshot(candles);
  assert.deepEqual(a,b);assert.equal(a.sessionOpens.previousDayHigh,110);
  assert.equal(a.bookmap.status,'standby');assert.equal(a.bookmap.pingMs,0);
  assert.ok(a.bookmap.data.icebergOrders.every(x=>x.time<=candles.at(-1).closeTime));
});

test('CZT signals, ATR and EMA prefix do not change when later candles are appended',()=>{
  const candles=Array.from({length:180},(_,i)=>({openTime:Date.UTC(2026,7,19,13,30)+i*60000,closeTime:Date.UTC(2026,7,19,13,31)+i*60000-1,open:100+i*.1,high:102+i*.1,low:99+i*.1,close:101+i*.1,volume:1000+i}));
  const prefix=calculateCztV2(candles.slice(0,120)),full=calculateCztV2(candles);
  assert.deepEqual(full.bars.slice(0,120),prefix.bars);
  assert.deepEqual(full.markers.filter(m=>m.time<=prefix.latest.time),prefix.markers);
});

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
