import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineMarketData, getOfflineSummary, getOfflineDateBounds, isOfflineDataAvailable } from '../lib/offline-market.ts';
import { chartHistory } from '../lib/market-data.ts';
import { SYMBOLS } from '../lib/replay.ts';

test('offline engine: summary provides valid data for all 4 assets', () => {
  const summary = getOfflineSummary();
  assert.equal(summary.version, 1);
  assert.ok(summary.updatedAt);
  for (const sym of SYMBOLS) {
    assert.ok(summary.symbols[sym], `Offline summary should exist for ${sym}`);
    assert.ok(summary.symbols[sym].timeframes['15m'], `15m data should exist for ${sym}`);
    assert.ok(summary.symbols[sym].timeframes['1m'], `1m data should exist for ${sym}`);
  }
});

test('offline engine: returns valid candle series for Gold, BTC, ETH, and SOL without internet', async () => {
  for (const sym of SYMBOLS) {
    const bounds = getOfflineDateBounds(sym, '15m');
    assert.ok(bounds, `Bounds must exist for ${sym}`);
    assert.ok(bounds.count > 0);
    assert.ok(bounds.start < bounds.end);

    const result = await offlineMarketData(sym, '15m', bounds.start, bounds.end);
    assert.ok(result.candles.length > 0);
    assert.ok(result.source.includes('المخزن المحلي'));

    // Test chartHistory integration
    const testSession = {
      id: `off-test-${sym}`,
      symbol: sym,
      startTime: bounds.end - 10 * 900000,
      cursorTime: bounds.end - 10 * 900000 - 1,
      advancedBars: 0,
      createdAt: new Date().toISOString(),
      isOffline: true,
    };
    const history = await chartHistory(testSession, '15m', offlineMarketData);
    assert.ok(history.candles.length > 0);
    assert.ok(history.candles[history.candles.length - 1].closeTime <= testSession.cursorTime + 900000);
  }
});
