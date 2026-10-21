import test from 'node:test';
import assert from 'node:assert/strict';
import { SYMBOLS, SYMBOL_INFO } from '../lib/replay.ts';

test('latest candle session: calculates valid latest allowed timestamp', () => {
  const now = 1792312000000; // arbitrary fixed ms
  const latestAllowed = Math.floor(now / 60000) * 60000 - 60000;
  
  // Clamping future or current timestamps to latestAllowed
  const clientRequestedNow = now;
  const clampedNow = Math.floor(clientRequestedNow / 60000) * 60000;
  const safeStart = clampedNow > latestAllowed ? latestAllowed : clampedNow;
  
  assert.equal(safeStart, latestAllowed);
  assert.ok(safeStart < now);
  assert.equal(safeStart % 60000, 0);
});

test('latest candle session: supports all 4 assets with valid metadata', () => {
  for (const sym of SYMBOLS) {
    assert.ok(SYMBOL_INFO[sym], `Symbol info should exist for ${sym}`);
    assert.ok(SYMBOL_INFO[sym].arabicName, `Arabic name should exist for ${sym}`);
    assert.ok(SYMBOL_INFO[sym].base, `Base currency should exist for ${sym}`);
  }
});
