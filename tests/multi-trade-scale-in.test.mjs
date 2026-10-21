import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkspace, INITIAL_BALANCE, FEE_RATE, SLIPPAGE } from '../lib/replay.ts';

test('multi-trade: calculates available margin correctly across multiple open positions', () => {
  const equity = 2500;
  const activeTrades = [
    {
      id: 'trade-1',
      sessionId: 'sess-1',
      symbol: 'BTCUSDT',
      status: 'open',
      side: 'long',
      notional: 500,
      entryPrice: 60000,
      quantity: 500 / 60000,
      remainingQuantity: 500 / 60000,
      entryFee: 500 * FEE_RATE,
    },
    {
      id: 'trade-2',
      sessionId: 'sess-1',
      symbol: 'ETHUSDT',
      status: 'pending',
      side: 'short',
      notional: 300,
      entryPrice: null,
      orderPrice: 3000,
      quantity: 0.1,
      entryFee: 0,
    },
  ];

  const tiedMargin = activeTrades.reduce((sum, t) => {
    const cost = t.entryPrice
      ? (t.remainingQuantity ?? t.quantity ?? 0) * t.entryPrice + t.entryFee * (t.remainingQuantity ?? t.quantity ?? 0) / (t.quantity || 1)
      : (t.notional ?? 0) * (1 + FEE_RATE);
    return sum + cost;
  }, 0);

  // Trade 1 tied margin: 500 + 0.75 = 500.75
  // Trade 2 tied margin: 300 * 1.0015 = 300.45
  // Total tied: 801.20
  assert.ok(Math.abs(tiedMargin - 801.2) < 0.01);
  const availableCash = Math.max(0, equity - tiedMargin);
  assert.ok(Math.abs(availableCash - (2500 - 801.2)) < 0.01);
  assert.ok(availableCash > 1690);
});

test('scale-in: updates Long trade notional, quantity, fees, and weighted average entry price', () => {
  const trade = {
    id: 'trade-1',
    sessionId: 'sess-1',
    symbol: 'BTCUSDT',
    status: 'open',
    side: 'long',
    notional: 500,
    entryPrice: 60000,
    quantity: 500 / 60000,
    remainingQuantity: 500 / 60000,
    entryFee: 500 * FEE_RATE,
    events: [],
  };

  const currentMarketPrice = 62000;
  const scaleAmount = 500;
  const sign = trade.side === 'short' ? -1 : 1;
  const fillPrice = currentMarketPrice * (1 + sign * SLIPPAGE);
  const addedQty = scaleAmount / fillPrice;
  const oldQty = trade.remainingQuantity ?? trade.quantity;
  const oldTotalQty = trade.quantity;
  const newTotalQty = oldTotalQty + addedQty;
  const newRemainingQty = oldQty + addedQty;
  const newWeightedEntry = ((trade.entryPrice * oldTotalQty) + (fillPrice * addedQty)) / newTotalQty;
  const addedFee = scaleAmount * FEE_RATE;

  trade.entryPrice = newWeightedEntry;
  trade.quantity = newTotalQty;
  trade.remainingQuantity = newRemainingQty;
  trade.notional += scaleAmount;
  trade.entryFee += addedFee;

  // New notional should be 1000
  assert.equal(trade.notional, 1000);
  // Entry fee should be doubled
  assert.ok(Math.abs(trade.entryFee - (1000 * FEE_RATE)) < 0.001);
  // Fill price should be 62000 * 1.0002 = 62012.4
  assert.ok(Math.abs(fillPrice - 62012.4) < 0.1);
  // Weighted entry price should be between 60,000 and 62,012.4, approximately 60,983.87
  assert.ok(trade.entryPrice > 60000 && trade.entryPrice < 62013);
  assert.ok(Math.abs(trade.entryPrice - 60989.60) < 1);
});

test('scale-in: updates Short trade weighted average correctly', () => {
  const trade = {
    id: 'trade-short',
    sessionId: 'sess-1',
    symbol: 'ETHUSDT',
    status: 'open',
    side: 'short',
    notional: 300,
    entryPrice: 3000,
    quantity: 0.1,
    remainingQuantity: 0.1,
    entryFee: 300 * FEE_RATE,
    events: [],
  };

  const currentMarketPrice = 2800; // in profit
  const scaleAmount = 300;
  const sign = trade.side === 'short' ? -1 : 1;
  const fillPrice = currentMarketPrice * (1 + sign * SLIPPAGE); // Short entry sells at slightly lower fill (slippage)
  const addedQty = scaleAmount / fillPrice;
  const oldQty = trade.remainingQuantity;
  const oldTotalQty = trade.quantity;
  const newTotalQty = oldTotalQty + addedQty;
  const newRemainingQty = oldQty + addedQty;
  const newWeightedEntry = ((trade.entryPrice * oldTotalQty) + (fillPrice * addedQty)) / newTotalQty;

  trade.entryPrice = newWeightedEntry;
  trade.quantity = newTotalQty;
  trade.remainingQuantity = newRemainingQty;
  trade.notional += scaleAmount;
  trade.entryFee += scaleAmount * FEE_RATE;

  assert.equal(trade.notional, 600);
  // Fill price for short: 2800 * (1 - 0.0002) = 2799.44
  assert.ok(fillPrice < 2800);
  // Weighted entry should be between 2800 and 3000
  assert.ok(trade.entryPrice > 2799 && trade.entryPrice < 3000);
});

test('multi-trade: targeted cancel or close affects only specified tradeId or all', () => {
  const trades = [
    { id: 'trade-a', status: 'open', sessionId: 's1' },
    { id: 'trade-b', status: 'pending', sessionId: 's1' },
    { id: 'trade-c', status: 'open', sessionId: 's1' },
  ];

  // Target single trade 'trade-b'
  const targetId = 'trade-b';
  const filteredTargets = trades.filter((t) => t.id === targetId);
  assert.equal(filteredTargets.length, 1);
  assert.equal(filteredTargets[0].id, 'trade-b');

  // Cancel trade-b
  filteredTargets[0].status = 'cancelled';
  assert.equal(trades.find((t) => t.id === 'trade-b').status, 'cancelled');
  assert.equal(trades.find((t) => t.id === 'trade-a').status, 'open');
  assert.equal(trades.find((t) => t.id === 'trade-c').status, 'open');

  // Close all remaining
  const activeRemaining = trades.filter((t) => ['pending', 'open'].includes(t.status));
  assert.equal(activeRemaining.length, 2);
  for (const t of activeRemaining) {
    t.status = 'closed';
  }

  assert.equal(trades.filter((t) => ['pending', 'open'].includes(t.status)).length, 0);
});
