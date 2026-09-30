import test from 'node:test';
import assert from 'node:assert/strict';
import { cashPreview } from '../lib/order-preview.ts';
import { finishTrade } from '../lib/replay.ts';

test('100 USDT ticket reserves 100.15 and estimates net target after both fees', () => {
  const q = cashPreview(100, 100, 90, 110, 'limit');
  assert.equal(q.total, 100.15);
  assert.ok(Math.abs(q.targetNet - 9.685) < 1e-9);
  assert.ok(q.stopNet < -10.15);
});
test('filled ticket uses actual quantity and paid fee, matching execution accounting', () => {
  const q = cashPreview(100, 105, 90, 110, 'stop', 102, 100/102, .15);
  const trade = {entryPrice:102,quantity:100/102,entryFee:.15,initialRisk:12*100/102,events:[]};
  finishTrade(trade,110,0,'target');
  assert.ok(Math.abs(q.targetNet-trade.realizedPnl)<1e-9);
});
test('invalid amount yields no monetary estimate', () => {
  assert.equal(cashPreview(NaN,100,90,110,'market'),null);
  assert.equal(cashPreview(0,100,90,110,'market'),null);
});
