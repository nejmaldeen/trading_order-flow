import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDailySessionProfiles, getUtcDayKey, getUtcWeekKey, getUtcMonthKey } from '../lib/session-volume-profile.ts';

test('getUtcDayKey: returns YYYY-MM-DD format correctly', () => {
  const ts = Date.UTC(2024, 2, 15, 14, 30); // 2024-03-15
  assert.equal(getUtcDayKey(ts), '2024-03-15');
});

test('getUtcWeekKey & getUtcMonthKey: format week and month keys correctly', () => {
  const ts = Date.UTC(2024, 2, 15, 14, 30); // 2024-03-15 (March 2024)
  assert.ok(getUtcWeekKey(ts).startsWith('2024-W'));
  assert.equal(getUtcMonthKey(ts), '2024-03');
});

test('computeDailySessionProfiles: correctly groups candles into distinct daily profiles with POC and Value Area', () => {
  // Generate 2 days of mock 15m candles
  const day1Start = Date.UTC(2024, 0, 1, 0, 0); // 2024-01-01
  const day2Start = Date.UTC(2024, 0, 2, 0, 0); // 2024-01-02

  const mockCandles = [];

  // Day 1: 96 candles
  for (let i = 0; i < 96; i++) {
    const openTime = day1Start + i * 15 * 60 * 1000;
    const basePrice = 40000 + Math.sin(i / 10) * 200;
    mockCandles.push({
      openTime,
      open: basePrice,
      high: basePrice + 50,
      low: basePrice - 50,
      close: basePrice + 10,
      volume: 100 + (i === 40 ? 1000 : 50), // spike at i=40 for clear POC
      closeTime: openTime + 15 * 60 * 1000 - 1,
    });
  }

  // Day 2: 96 candles
  for (let i = 0; i < 96; i++) {
    const openTime = day2Start + i * 15 * 60 * 1000;
    const basePrice = 42000 + Math.cos(i / 10) * 300;
    mockCandles.push({
      openTime,
      open: basePrice,
      high: basePrice + 60,
      low: basePrice - 60,
      close: basePrice - 20,
      volume: 150 + (i === 30 ? 1200 : 80),
      closeTime: openTime + 15 * 60 * 1000 - 1,
    });
  }

  const profiles = computeDailySessionProfiles(mockCandles, 32, 0.70, "15m", "day");

  assert.equal(profiles.length, 2, 'Should create exactly 2 daily profiles');
  assert.equal(profiles[0].dateKey, '2024-01-01');
  assert.equal(profiles[1].dateKey, '2024-01-02');

  for (const session of profiles) {
    assert.ok(session.profile.pocPrice > 0, 'POC price should be valid');
    assert.ok(session.profile.vahPrice >= session.profile.valPrice, 'VAH must be >= VAL');
    assert.ok(session.profile.buckets.length > 0, 'Buckets should exist');
    assert.equal(session.candleCount, 96, 'Day should contain 96 candles');

    const pocBucket = session.profile.buckets.find(b => b.isPoc);
    assert.ok(pocBucket, 'There must be a designated POC bucket');
    assert.ok(pocBucket.isValueArea, 'POC must be inside the Value Area');
  }
});

test('computeDailySessionProfiles on 1d: automatically groups by week in auto mode to prevent crowding', () => {
  // Generate 14 daily candles (2 weeks)
  const start = Date.UTC(2024, 0, 1, 0, 0); // Monday Jan 1 2024
  const dailyCandles = [];
  for (let d = 0; d < 14; d++) {
    const openTime = start + d * 86400000;
    dailyCandles.push({
      openTime,
      open: 50000 + d * 100,
      high: 50200 + d * 100,
      low: 49800 + d * 100,
      close: 50100 + d * 100,
      volume: 5000 + d * 200,
      closeTime: openTime + 86400000 - 1,
    });
  }

  // Auto mode on 1d timeframe should produce weekly profiles instead of 14 cramped overlapping profiles!
  const weeklyProfiles = computeDailySessionProfiles(dailyCandles, 32, 0.70, "1d", "auto");
  assert.equal(weeklyProfiles.length, 2, 'Should group 14 daily candles into 2 weekly profiles');
  assert.equal(weeklyProfiles[0].candleCount, 7, 'Week 1 should have 7 daily candles');
  assert.equal(weeklyProfiles[1].candleCount, 7, 'Week 2 should have 7 daily candles');
  assert.ok(weeklyProfiles[0].label.includes('أسبوع'));
});
