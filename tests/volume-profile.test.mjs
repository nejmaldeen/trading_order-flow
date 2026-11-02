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
test('value area crosses empty levels from either boundary and conserves volume', () => {
  for (const [lower, upper] of [[5,5],[6,4],[4,6]]) {
    const candles = [lower,upper].map((volume,i) => ({low:i*10,high:i*10,open:i*10,close:i*10,volume}));
    for (const ratio of [0.7,0.99999]) {
      const p = computeVolumeProfile(candles, 32, ratio);
      assert.equal(p.buckets.filter(b=>b.isValueArea).reduce((s,b)=>s+b.totalVolume,0),10);
      assert.equal(p.valPrice,0);
      assert.equal(p.vahPrice,10);
      assert.equal(p.buckets.findIndex(b=>b.isPoc),lower>=upper?0:31);
    }
  }
});
test('flat price, invalid inputs and resource limits', () => {
  const candles=[{low:7,high:7,open:7,close:7,volume:12}];
  assert.equal(computeVolumeProfile(candles).pocVolume,12);
  for (const n of [0,1.5,Infinity,1e9]) assert.equal(computeVolumeProfile(candles,n),null);
  assert.equal(computeVolumeProfile(candles,1,NaN),null);
  assert.equal(computeVolumeProfile([{...candles[0],volume:NaN}]),null);
});
test('dense bounded profile covers its target and rejects excessive work', () => {
  const c={open:1,low:1,high:65537,close:2,volume:65536};
  const p=computeVolumeProfile([c],65536,0.99999);
  assert.equal(p.buckets.filter(b=>b.isValueArea).length,65536);
  assert.equal(computeVolumeProfile(Array(153).fill(c),65536),null);
});
