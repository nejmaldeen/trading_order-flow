import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Opt-in only: run against a separately initialized QA D1 database, never user data.
const base = process.env.QA_LAB_URL;
test('live SIP API: four assets, RTH transitions, order lifecycle and durable reads', {skip: !base, timeout: 1200000}, async () => {
  const url = new URL(base);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  assert.equal(process.env.QA_ISOLATED_DB, 'yes', 'A separate QA database is required');
  const headers = {'Content-Type':'application/json','oai-authenticated-user-id':`sip-qa-${randomUUID()}`};
  let state = (await (await fetch(new URL('/api/lab',url),{headers})).json()).state;
  async function act(input,attempt=0) {
    const started=Date.now();
    const response=await fetch(new URL('/api/lab',url),{method:'POST',headers,body:JSON.stringify({revision:state.revision,timeframe:'1m',...input}),signal:AbortSignal.timeout(240000)});
    const body=await response.json();
    if(response.status===500 && body.error?.includes('انقطع اتصال Alpaca') && attempt<2) {
      const unchanged=(await (await fetch(new URL('/api/lab',url),{headers})).json()).state;
      assert.deepEqual(unchanged,state,'Upstream failure must not mutate saved state');
      console.log(`${input.action}: upstream connection failed; saved state unchanged; retry ${attempt+1}`);
      return act(input,attempt+1);
    }
    assert.equal(response.status,200,`${input.action}: ${body.error}`);
    state=body.state;
    console.log(`${input.action} ${input.symbol??''}: ${body.candles?.length??0} bars, ${Date.now()-started} ms`);
    return body;
  }
  const current=()=>state.sessions.find(s=>s.id===state.activeSessionId);
  for(const symbol of ['AAPL','NVDA','AMD','GOOGL']) {
    await act({action:'start',symbol,startTime:Date.parse('2026-08-19T13:30:00Z'),confirmReplace:true});
    const step=await act({action:'step',unit:'bar',timeframe:'15m'});
    assert.equal(step.candles.length,15);assert.equal(current().cursorTime,Date.parse('2026-08-19T13:45:00Z')-1);
    assert.equal(step.source,'Alpaca SIP · 1m raw · RTH');
  }
  const price=(await act({action:'step',unit:'minute'})).candles.at(-1).close;
  await act({action:'buy',notional:100,stopLoss:price*.8,takeProfit:price*1.2});
  const id=state.trades[0].id;assert.equal(state.trades[0].status,'pending');
  await act({action:'step',unit:'minute'});assert.equal(state.trades[0].status,'open');
  await act({action:'scale_in',tradeId:id,amount:50});assert.equal(state.trades[0].pendingScaleIn,50);
  await act({action:'step',unit:'minute'});assert.equal(state.trades[0].notional,150);
  await act({action:'close',tradeId:id});assert.equal(state.trades[0].status,'close_pending');
  await act({action:'step',unit:'minute'});assert.equal(state.trades[0].status,'closed');
  for(const [before,after] of [
    ['2026-09-04T19:59:00Z','2026-09-08T13:30:00Z'],
    ['2025-11-28T17:59:00Z','2025-12-01T14:30:00Z'],
    ['2026-03-06T20:59:00Z','2026-03-09T13:30:00Z'],
  ]) {
    await act({action:'start',symbol:'AAPL',startTime:Date.parse(before),confirmReplace:true});
    const step=await act({action:'step',unit:'minute',count:2});
    assert.deepEqual(step.candles.map(c=>c.openTime),[Date.parse(before),Date.parse(after)]);
  }
  const saved=(await (await fetch(new URL('/api/lab',url),{headers})).json()).state;
  assert.deepEqual(saved,state);
  const stale=await fetch(new URL('/api/lab',url),{method:'POST',headers,body:JSON.stringify({revision:0,action:'step'})});
  assert.equal(stale.status,409);
});
