import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVolumeProfile } from '../lib/volume-profile.ts';

test('computeVolumeProfile returns null for empty candle list', () => {
  assert.equal(computeVolumeProfile([]), null);
});

test('computeVolumeProfile correctly identifies POC, VAH, and VAL', () => {
  const candles = [
    { openTime: 1000, closeTime: 1999, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
    { openTime: 2000, closeTime: 2999, open: 102, high: 104, low: 98, close: 103, volume: 2000 },
    { openTime: 3000, closeTime: 3999, open: 103, high: 108, low: 101, close: 107, volume: 500 },
  ];

  const profile = computeVolumeProfile(candles, 20);
  assert.ok(profile !== null);
  assert.ok(profile.pocPrice >= 95 && profile.pocPrice <= 108);
  assert.ok(profile.vahPrice >= profile.pocPrice);
  assert.ok(profile.valPrice <= profile.pocPrice);
  assert.ok(profile.buckets.length === 20);
  assert.ok(profile.buckets.some(b => b.isPoc));
});
