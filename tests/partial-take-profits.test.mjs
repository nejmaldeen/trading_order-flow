import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCandle, normalizeWorkspace, FEE_RATE, SLIPPAGE } from '../lib/replay.ts';
import { validateTakeProfitLevels } from '../lib/stop-levels.ts';

const trade = () => ({
  id: 'tp-trade-1',
  sessionId: 's1',
  side: 'long',
  status: 'open',
  entryPrice: 100,
  quantity: 1,
  notional: 100,
  entryFee: 0.15,
  exitFee: 0,
  realizedPnl: 0,
  initialRisk: 20,
  stopLoss: 80,
  takeProfit: 150,
  events: [],
  takeProfitLevels: [
    { id: 'tp1', price: 110, amount: 20, percentage: 20, eligibleTime: 60000, filled: false },
    { id: 'tp2', price: 125, amount: 50, percentage: 50, eligibleTime: 60000, filled: false }
  ]
});

const bar = (n = 1, values = {}) => ({
  openTime: n * 60000,
  closeTime: (n + 1) * 60000 - 1,
  open: 100,
  high: 105,
  low: 98,
  close: 102,
  volume: 1,
  ...values
});

function step(t, c) {
  applyCandle({ trades: [t] }, { id: 's1' }, c);
}

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('validation accepts valid take profit levels above entry', () => {
  const t = trade();
  assert.equal(validateTakeProfitLevels(t, [
    { price: 110, amount: 20 },
    { price: 125, amount: 50 }
  ], 100), null);
});

test('validation rejects take profit levels below entry or exceeding position', () => {
  const t = trade();
  // Below entry
  assert.ok(validateTakeProfitLevels(t, [{ price: 95, amount: 20 }], 100));
  // At entry
  assert.ok(validateTakeProfitLevels(t, [{ price: 100, amount: 20 }], 100));
  // Exceeding total notional (100)
  assert.ok(validateTakeProfitLevels(t, [{ price: 110, amount: 120 }], 100));
  // Duplicate price
  assert.ok(validateTakeProfitLevels(t, [{ price: 110, amount: 20 }, { price: 110, amount: 30 }], 100));
});

test('partial take profit executes when candle touches target price', () => {
  const t = trade();
  // Bar 1 does not reach 110 (high is 105)
  step(t, bar(1, { high: 105 }));
  assert.equal(t.status, 'open');
  assert.equal(t.takeProfitLevels[0].filled, false);

  // Bar 2 reaches 112 (crosses TP1 at 110)
  step(t, bar(2, { high: 112, close: 108 }));
  assert.equal(t.status, 'open');
  assert.equal(t.takeProfitLevels[0].filled, true);
  assert.equal(t.takeProfitLevels[1].filled, false);

  // 20 USDT out of 100 notional = 0.2 quantity closed
  near(t.remainingQuantity, 0.8);
  assert.equal(t.partialExits.length, 1);
  assert.equal(t.partialExits[0].type, 'take-profit-partial');
  assert.ok(t.realizedPnl > 0);

  // Bar 3 touches 130 (crosses TP2 at 125)
  step(t, bar(3, { high: 130, close: 128 }));
  assert.equal(t.status, 'open');
  assert.equal(t.takeProfitLevels[1].filled, true);
  near(t.remainingQuantity, 0.3);
  assert.equal(t.partialExits.length, 2);
});

test('take profit that consumes entire remaining quantity closes trade', () => {
  const t = trade();
  t.takeProfitLevels = [
    { id: 'tp-full', price: 110, amount: 100, percentage: 100, eligibleTime: 60000, filled: false }
  ];
  step(t, bar(1, { high: 115 }));
  assert.equal(t.status, 'closed');
  near(t.remainingQuantity, 0);
  assert.ok(t.realizedPnl > 0);
});

test('normalizeWorkspace preserves takeProfitLevels', () => {
  const t = trade();
  const normalized = normalizeWorkspace({ trades: [t] });
  assert.deepEqual(normalized.trades[0].takeProfitLevels, t.takeProfitLevels);
});
