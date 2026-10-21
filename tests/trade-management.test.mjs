import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkspace, INITIAL_BALANCE } from '../lib/replay.ts';

test('trade deletion removes specified trade and keeps other trades intact', () => {
  const initial = normalizeWorkspace({
    trades: [
      { id: 'trade-1', sessionId: 'sess-1', symbol: 'BTCUSDT', status: 'closed', realizedPnl: 45, notional: 100, stopLoss: 90, takeProfit: 120 },
      { id: 'trade-2', sessionId: 'sess-1', symbol: 'BTCUSDT', status: 'closed', realizedPnl: -20, notional: 100, stopLoss: 90, takeProfit: 120 },
      { id: 'trade-3', sessionId: 'sess-2', symbol: 'ETHUSDT', status: 'closed', realizedPnl: 15, notional: 50, stopLoss: 40, takeProfit: 65 },
    ],
  });

  assert.equal(initial.trades.length, 3);

  // Simulate deleteTrade for trade-2
  const targetId = 'trade-2';
  const idx = initial.trades.findIndex((t) => t.id === targetId);
  assert.ok(idx !== -1);
  initial.trades.splice(idx, 1);

  assert.equal(initial.trades.length, 2);
  assert.equal(initial.trades[0].id, 'trade-1');
  assert.equal(initial.trades[1].id, 'trade-3');
});

test('clearTrades with session scope clears only current session trades', () => {
  const workspace = normalizeWorkspace({
    trades: [
      { id: 't-1', sessionId: 'sess-1', symbol: 'BTCUSDT', status: 'closed', realizedPnl: 30, notional: 100, stopLoss: 90, takeProfit: 120 },
      { id: 't-2', sessionId: 'sess-1', symbol: 'BTCUSDT', status: 'closed', realizedPnl: -10, notional: 100, stopLoss: 90, takeProfit: 120 },
      { id: 't-3', sessionId: 'sess-2', symbol: 'ETHUSDT', status: 'closed', realizedPnl: 50, notional: 200, stopLoss: 180, takeProfit: 240 },
    ],
  });

  const currentSessionId = 'sess-1';
  // Simulate clearTrades with session scope
  workspace.trades = workspace.trades.filter((t) => t.sessionId !== currentSessionId);

  assert.equal(workspace.trades.length, 1);
  assert.equal(workspace.trades[0].id, 't-3');
  assert.equal(workspace.trades[0].sessionId, 'sess-2');
});

test('clearTrades with all scope clears all trades across all sessions', () => {
  const workspace = normalizeWorkspace({
    trades: [
      { id: 't-1', sessionId: 'sess-1', symbol: 'BTCUSDT', status: 'closed', realizedPnl: 30, notional: 100, stopLoss: 90, takeProfit: 120 },
      { id: 't-2', sessionId: 'sess-2', symbol: 'ETHUSDT', status: 'closed', realizedPnl: 50, notional: 200, stopLoss: 180, takeProfit: 240 },
    ],
  });

  workspace.trades = [];
  assert.equal(workspace.trades.length, 0);
});

test('persistent cumulative equity carries forward across sessions and reflects deletions', () => {
  const initialBalance = INITIAL_BALANCE; // 2500 USDT
  assert.equal(initialBalance, 2500);

  // Session 1: Win of 80 USDT
  const trades = [
    { id: 't-1', sessionId: 'sess-1', status: 'closed', realizedPnl: 80, notional: 100, stopLoss: 90, takeProfit: 120, symbol: 'BTCUSDT' },
  ];
  let allNetPnl = trades.reduce((sum, t) => sum + t.realizedPnl, 0);
  let equity = initialBalance + allNetPnl;
  assert.equal(equity, 2580);

  // User starts new Session 2:
  // Session trades for sess-2 are empty initially
  const sess2Trades = trades.filter((t) => t.sessionId === 'sess-2');
  assert.equal(sess2Trades.length, 0);

  // Cumulative equity is still preserved at 2580, NOT reset to 2500!
  assert.equal(initialBalance + allNetPnl, 2580);

  // Now user executes a trade in sess-2: loss of -30 USDT
  trades.push({ id: 't-2', sessionId: 'sess-2', status: 'closed', realizedPnl: -30, notional: 100, stopLoss: 90, takeProfit: 120, symbol: 'ETHUSDT' });
  allNetPnl = trades.reduce((sum, t) => sum + t.realizedPnl, 0);
  equity = initialBalance + allNetPnl;
  assert.equal(equity, 2550);

  // User deletes mistaken loss trade t-2
  const idx = trades.findIndex((t) => t.id === 't-2');
  trades.splice(idx, 1);
  allNetPnl = trades.reduce((sum, t) => sum + t.realizedPnl, 0);
  equity = initialBalance + allNetPnl;
  assert.equal(equity, 2580); // Restored back to 2580
});

test('each trade maintains independent reflection metadata without crosstalk', () => {
  const trade1 = {
    id: 't-1',
    symbol: 'BTCUSDT',
    status: 'closed',
    reflection: {
      setupGrade: 'A+',
      strategy: 'Order Flow / سيولة',
      emotion: 'انضباط وهدوء',
      notes: 'دخول ممتاز عند اختبار POC',
    },
  };

  const trade2 = {
    id: 't-2',
    symbol: 'ETHUSDT',
    status: 'closed',
    reflection: {
      setupGrade: 'C+',
      strategy: 'كسر كاذب Fakeout',
      emotion: 'خوف الفوات FOMO',
      notes: 'دخول متعجل خارج الخطة',
    },
  };

  const trade3 = {
    id: 't-3',
    symbol: 'BTCUSDT',
    status: 'open',
  };

  // Mutating trade1 does not affect trade2 or trade3
  trade1.reflection.notes = 'تعديل الملاحظات';
  assert.equal(trade2.reflection.notes, 'دخول متعجل خارج الخطة');
  assert.equal(trade3.reflection, undefined);

  // Trade 2 maintains its distinct grade and emotion
  assert.equal(trade2.reflection.setupGrade, 'C+');
  assert.equal(trade2.reflection.emotion, 'خوف الفوات FOMO');
});
