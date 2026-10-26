import test from "node:test";
import assert from "node:assert/strict";
import {
  FEE_RATE,
  SLIPPAGE,
  applyCandle,
  finishTrade,
  blank,
  availableReplayCash,
} from "../lib/replay.ts";
import { validateTakeProfitLevels, validateStopLevels } from "../lib/stop-levels.ts";

test('cash releases partial exits and reserves queued scale-in identically for client and server',()=>{
  const state={...structuredClone(blank),initialBalance:1000,trades:[{sessionId:'s',status:'open',notional:1000,entryPrice:100,quantity:10,remainingQuantity:5,entryFee:1.5,realizedPnl:49,pendingScaleIn:100}]};
  assert.equal(availableReplayCash(state,'s'),1049-500-.75-100.15);
  assert.equal(state.trades[0].realizedPnl,49);
});

test("accounting: Long trade gross PnL, deducted fees, and net realized PnL", () => {
  const entryPrice = 100000;
  const notional = 10000;
  const quantity = notional / entryPrice; // 0.1 BTC
  const entryFee = notional * FEE_RATE; // 15 USDT

  const trade = {
    id: "test-long-1",
    sessionId: "sess-1",
    symbol: "BTCUSDT",
    status: "open",
    side: "long",
    orderType: "market",
    orderPrice: null,
    eligibleTime: 0,
    triggeredAt: null,
    notional,
    quantity,
    entryPrice,
    stopLoss: 95000,
    takeProfit: 105000,
    initialStop: 95000,
    initialTarget: 105000,
    exitPrice: null,
    entryFee,
    exitFee: 0,
    realizedPnl: 0,
    rMultiple: null,
    initialRisk: (entryPrice - 95000) * quantity, // 500 USDT
    reason: "testing",
    entryTime: 1000,
    exitTime: null,
    createdAt: new Date().toISOString(),
    exitReason: null,
    events: [],
  };

  const exitPrice = 105000;
  finishTrade(trade, exitPrice, 2000, "جني الأرباح");

  const expectedGrossPnl = (exitPrice - entryPrice) * quantity; // 500 USDT
  const expectedExitFee = exitPrice * quantity * FEE_RATE; // 10500 * 0.0015 = 15.75 USDT
  const expectedTotalFees = entryFee + expectedExitFee; // 15 + 15.75 = 30.75 USDT
  const expectedNetPnl = expectedGrossPnl - expectedTotalFees; // 500 - 30.75 = 469.25 USDT

  assert.equal(trade.status, "closed");
  assert.equal(trade.exitPrice, exitPrice);
  assert.ok(Math.abs(trade.exitFee - expectedExitFee) < 1e-9, `Exit fee ${trade.exitFee} should equal ${expectedExitFee}`);
  assert.ok(Math.abs(trade.totalFees - expectedTotalFees) < 1e-9, `Total fees ${trade.totalFees} should equal ${expectedTotalFees}`);
  assert.ok(Math.abs(trade.grossPnl - expectedGrossPnl) < 1e-9, `Gross PnL ${trade.grossPnl} should equal ${expectedGrossPnl}`);
  assert.ok(Math.abs(trade.realizedPnl - expectedNetPnl) < 1e-9, `Realized PnL ${trade.realizedPnl} should equal ${expectedNetPnl}`);

  // Gross PnL identity check: Net + TotalFees === Gross
  const derivedGross = trade.realizedPnl + trade.totalFees;
  assert.ok(Math.abs(derivedGross - expectedGrossPnl) < 1e-9, `Derived gross ${derivedGross} should equal ${expectedGrossPnl}`);
});

test("accounting: Short trade gross PnL, deducted fees, and net realized PnL", () => {
  const entryPrice = 100000;
  const notional = 10000;
  const quantity = notional / entryPrice; // 0.1 BTC
  const entryFee = notional * FEE_RATE; // 15 USDT

  const trade = {
    id: "test-short-1",
    sessionId: "sess-1",
    symbol: "BTCUSDT",
    status: "open",
    side: "short",
    orderType: "market",
    orderPrice: null,
    eligibleTime: 0,
    triggeredAt: null,
    notional,
    quantity,
    entryPrice,
    stopLoss: 105000,
    takeProfit: 95000,
    initialStop: 105000,
    initialTarget: 95000,
    exitPrice: null,
    entryFee,
    exitFee: 0,
    realizedPnl: 0,
    rMultiple: null,
    initialRisk: (105000 - entryPrice) * quantity, // 500 USDT
    reason: "testing short",
    entryTime: 1000,
    exitTime: null,
    createdAt: new Date().toISOString(),
    exitReason: null,
    events: [],
  };

  const exitPrice = 95000;
  finishTrade(trade, exitPrice, 2000, "جني الأرباح");

  const expectedGrossPnl = (entryPrice - exitPrice) * quantity; // +500 USDT
  const expectedExitFee = exitPrice * quantity * FEE_RATE; // 9500 * 0.0015 = 14.25 USDT
  const expectedTotalFees = entryFee + expectedExitFee; // 15 + 14.25 = 29.25 USDT
  const expectedNetPnl = expectedGrossPnl - expectedTotalFees; // 500 - 29.25 = 470.75 USDT

  assert.equal(trade.status, "closed");
  assert.equal(trade.exitPrice, exitPrice);
  assert.ok(Math.abs(trade.exitFee - expectedExitFee) < 1e-9, `Exit fee ${trade.exitFee} should equal ${expectedExitFee}`);
  assert.ok(Math.abs(trade.totalFees - expectedTotalFees) < 1e-9, `Total fees ${trade.totalFees} should equal ${expectedTotalFees}`);
  assert.ok(Math.abs(trade.grossPnl - expectedGrossPnl) < 1e-9, `Gross PnL ${trade.grossPnl} should equal ${expectedGrossPnl}`);
  assert.ok(Math.abs(trade.realizedPnl - expectedNetPnl) < 1e-9, `Realized PnL ${trade.realizedPnl} should equal ${expectedNetPnl}`);

  // Gross PnL identity check: Net + TotalFees === Gross
  const derivedGross = trade.realizedPnl + trade.totalFees;
  assert.ok(Math.abs(derivedGross - expectedGrossPnl) < 1e-9, `Derived gross ${derivedGross} should equal ${expectedGrossPnl}`);
});

test("accounting: Stop loss execution with slippage correctly deducts gross loss and fees", () => {
  const entryPrice = 100000;
  const notional = 10000;
  const quantity = notional / entryPrice; // 0.1 BTC
  const entryFee = notional * FEE_RATE; // 15 USDT

  const trade = {
    id: "test-sl-1",
    sessionId: "sess-1",
    symbol: "BTCUSDT",
    status: "open",
    side: "long",
    orderType: "market",
    orderPrice: null,
    eligibleTime: 0,
    triggeredAt: null,
    notional,
    quantity,
    entryPrice,
    stopLoss: 98000,
    takeProfit: 105000,
    initialStop: 98000,
    initialTarget: 105000,
    exitPrice: null,
    entryFee,
    exitFee: 0,
    realizedPnl: 0,
    rMultiple: null,
    initialRisk: 200,
    reason: "stop loss test",
    entryTime: 1000,
    exitTime: null,
    createdAt: new Date().toISOString(),
    exitReason: null,
    events: [],
  };

  const state = { ...blank, sessions: [{ id: "sess-1", symbol: "BTCUSDT", startTime: 1000, cursorTime: 1000, advancedBars: 1, createdAt: "" }], trades: [trade] };
  const session = state.sessions[0];

  // Candle drops to 97,000, breaching stop loss at 98,000
  const candle = {
    openTime: 60000,
    closeTime: 119999,
    open: 99000,
    high: 99500,
    low: 97000,
    close: 97500,
    volume: 10,
  };

  applyCandle(state, session, candle);

  assert.equal(trade.status, "closed");
  assert.equal(trade.exitReason, "وقف الخسارة");
  // Long stop fill: Math.min(open 99000, stop 98000) * (1 - SLIPPAGE) = 98000 * 0.9998 = 97980.4
  const expectedFill = 98000 * (1 - SLIPPAGE);
  assert.equal(trade.exitPrice, expectedFill);

  const expectedGrossLoss = (expectedFill - entryPrice) * quantity; // negative
  const expectedExitFee = expectedFill * quantity * FEE_RATE;
  const expectedNetLoss = expectedGrossLoss - entryFee - expectedExitFee;

  assert.ok(Math.abs(trade.grossPnl - expectedGrossLoss) < 1e-9);
  assert.ok(Math.abs(trade.realizedPnl - expectedNetLoss) < 1e-9);
  assert.ok(Math.abs((trade.realizedPnl + trade.totalFees) - trade.grossPnl) < 1e-9, "Net + TotalFees === Gross");
});

test("accounting: Partial take profits with remaining final exit reconciles 100% of volume and fees", () => {
  const entryPrice = 100;
  const notional = 1000;
  const quantity = 10;
  const entryFee = 1000 * FEE_RATE; // 1.5 USDT

  const trade = {
    id: "partial-tp-full-recon",
    sessionId: "sess-1",
    symbol: "BTCUSDT",
    status: "open",
    side: "long",
    orderType: "market",
    orderPrice: null,
    eligibleTime: 0,
    triggeredAt: null,
    notional,
    quantity,
    entryPrice,
    stopLoss: 90,
    takeProfit: 120,
    initialStop: 90,
    initialTarget: 120,
    exitPrice: null,
    entryFee,
    exitFee: 0,
    realizedPnl: 0,
    rMultiple: null,
    initialRisk: 100,
    reason: "partial tp test",
    entryTime: 1000,
    exitTime: null,
    createdAt: new Date().toISOString(),
    exitReason: null,
    events: [],
    takeProfitLevels: [
      { id: "tp1", price: 110, amount: 400, percentage: 40, eligibleTime: 60000, filled: false }, // 4 units
      { id: "tp2", price: 115, amount: 300, percentage: 30, eligibleTime: 60000, filled: false }, // 3 units
    ]
  };

  const state = { ...blank, sessions: [{ id: "sess-1", symbol: "BTCUSDT", startTime: 1000, cursorTime: 1000, advancedBars: 1, createdAt: "" }], trades: [trade] };
  const session = state.sessions[0];

  // Candle 1 reaches 112 (triggers tp1)
  const c1 = { openTime: 60000, closeTime: 119999, open: 105, high: 112, low: 104, close: 108, volume: 10 };
  applyCandle(state, session, c1);

  assert.equal(trade.status, "open");
  assert.equal(trade.partialExits.length, 1);
  assert.equal(trade.partialExits[0].quantity, 4);
  assert.equal(trade.remainingQuantity, 6);

  // Candle 2 reaches 125 (triggers tp2, and then touches final target 120)
  const c2 = { openTime: 120000, closeTime: 179999, open: 109, high: 125, low: 108, close: 122, volume: 10 };
  applyCandle(state, session, c2);

  assert.equal(trade.status, "closed");
  assert.equal(trade.remainingQuantity, 0);

  // Check mathematical identity:
  // Gross PnL - Total Fees === Net Realized PnL
  assert.ok(Math.abs(trade.realizedPnl - (trade.grossPnl - trade.totalFees)) < 1e-9, "Exact identity: realizedPnl === grossPnl - totalFees");
  assert.ok(trade.grossPnl > 0, "Gross profit must be strictly positive");
  assert.ok(trade.totalFees > 0, "Total fees must be positive");
  assert.ok(trade.realizedPnl > 0, "Net profit must be positive");
});

test("validation: validateTakeProfitLevels for Short trade", () => {
  const shortTrade = {
    id: "short-tp-val",
    sessionId: "sess-1",
    symbol: "BTCUSDT",
    status: "open",
    side: "short",
    orderType: "market",
    orderPrice: null,
    eligibleTime: 0,
    triggeredAt: null,
    notional: 1000,
    quantity: 0.01,
    entryPrice: 100000,
    stopLoss: 105000,
    takeProfit: 90000,
    initialStop: 105000,
    initialTarget: 90000,
    exitPrice: null,
    entryFee: 1.5,
    exitFee: 0,
    realizedPnl: 0,
    rMultiple: null,
    initialRisk: 50,
    reason: "",
    entryTime: 1000,
    exitTime: null,
    createdAt: "",
    exitReason: null,
    events: [],
  };

  // Valid short TP: 95000 (below entry 100,000, above final TP 90,000)
  const err1 = validateTakeProfitLevels(shortTrade, [{ price: 95000, amount: 500 }], 99000);
  assert.equal(err1, null, "Should accept valid short take profit levels below entry");

  // Invalid short TP: 102000 (above entry for short)
  const err2 = validateTakeProfitLevels(shortTrade, [{ price: 102000, amount: 500 }], 99000);
  assert.notEqual(err2, null, "Should reject take profit levels above entry for short");
});

test("validation: validateStopLevels for both Long and Short", () => {
  const longTrade = {
    id: "long-sl-val",
    sessionId: "sess-1",
    symbol: "BTCUSDT",
    status: "open",
    side: "long",
    orderType: "market",
    orderPrice: null,
    eligibleTime: 0,
    triggeredAt: null,
    notional: 1000,
    quantity: 0.01,
    entryPrice: 100000,
    stopLoss: 90000,
    takeProfit: 110000,
    initialStop: 90000,
    initialTarget: 110000,
    exitPrice: null,
    entryFee: 1.5,
    exitFee: 0,
    realizedPnl: 0,
    rMultiple: null,
    initialRisk: 100,
    reason: "",
    entryTime: 1000,
    exitTime: null,
    createdAt: "",
    exitReason: null,
    events: [],
  };

  // Valid Long stop level: 95000 (between current 100,000 and stopLoss 90,000)
  const errLong = validateStopLevels(longTrade, [{ price: 95000, amount: 500 }], 100000);
  assert.equal(errLong, null);

  const shortTrade = {
    ...longTrade,
    side: "short",
    stopLoss: 110000,
    takeProfit: 90000,
  };

  // Valid Short stop level: 105000 (between current 100,000 and stopLoss 110,000)
  const errShort = validateStopLevels(shortTrade, [{ price: 105000, amount: 500 }], 100000);
  assert.equal(errShort, null);
});
