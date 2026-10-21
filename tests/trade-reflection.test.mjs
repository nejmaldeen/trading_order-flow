import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkspace } from '../lib/replay.ts';

test('normalizeWorkspace preserves reflection metadata', () => {
  const raw = {
    trades: [
      {
        id: 't-123',
        sessionId: 's-123',
        symbol: 'BTCUSDT',
        status: 'open',
        notional: 100,
        stopLoss: 90,
        takeProfit: 120,
        reflection: {
          setupGrade: 'A+',
          strategy: 'Order Flow / سيولة',
          emotion: 'انضباط وهدوء',
          confidence: '100% عالي جداً',
          notes: 'تمركز واضح عند POC مع كسر كاذب للقاع السابق',
          audioNote: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8USA...',
        },
      },
    ],
  };

  const state = normalizeWorkspace(raw);
  assert.equal(state.trades.length, 1);
  const trade = state.trades[0];
  assert.ok(trade.reflection);
  assert.equal(trade.reflection.setupGrade, 'A+');
  assert.equal(trade.reflection.strategy, 'Order Flow / سيولة');
  assert.equal(trade.reflection.emotion, 'انضباط وهدوء');
  assert.equal(trade.reflection.confidence, '100% عالي جداً');
  assert.ok(trade.reflection.audioNote?.startsWith('data:audio/webm;base64'));
});
