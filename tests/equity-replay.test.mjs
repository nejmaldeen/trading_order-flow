import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newYorkTime, aggregateEquity, validateEquityMinutes } from '../lib/equity-market.ts';
import { blank, advance, applyCandle, appendReplayBatch, normalizeWorkspace } from '../lib/replay.ts';

const minute = (t, values={}) => ({openTime:t,closeTime:t+59999,open:100,high:102,low:99,close:101,volume:10,...values});
const session = (t) => ({id:'s',symbol:'AAPL',startTime:t,cursorTime:t-1,advancedBars:0,createdAt:'',engineVersion:2,dataSource:'alpaca-sip-raw'});
const workspace = (t) => ({...structuredClone(blank),activeSessionId:'s',sessions:[session(t)]});
const T = Date.parse('2026-08-19T13:30:00Z');
const trade = () => ({id:'t',sessionId:'s',symbol:'AAPL',status:'open',side:'long',orderType:'market',orderPrice:null,eligibleTime:T,triggeredAt:null,notional:100,quantity:1,entryPrice:100,stopLoss:90,takeProfit:120,initialRisk:10,initialStop:90,initialTarget:120,entryFee:.15,exitFee:0,realizedPnl:0,rMultiple:null,exitPrice:null,entryTime:T,exitTime:null,exitReason:null,reason:'',createdAt:'',events:[]});

test('New York RTH converts summer, winter and both DST boundaries',()=>{
  for (const [date,utc] of [['2026-08-19','13:30'],['2026-03-06','14:30'],['2026-03-09','13:30'],['2026-10-30','13:30'],['2026-11-02','14:30']]) assert.equal(newYorkTime(date,'09:30'),Date.parse(`${date}T${utc}:00Z`));
});
test('session-anchored aggregation retains shortened last hour and early close',()=>{
  const open=newYorkTime('2025-11-28','09:30'),close=newYorkTime('2025-11-28','13:00');
  const minutes=Array.from({length:210},(_,i)=>minute(open+i*60000));
  const days=[{date:'2025-11-28',open,close}];
  const hours=aggregateEquity(minutes,'1h',days);
  assert.equal(hours.length,4);assert.equal(hours.at(-1).volume,300);assert.equal(hours.at(-1).closeTime,close-1);
  assert.equal(aggregateEquity(minutes,'5m',days).length,42);
  assert.deepEqual(JSON.parse(JSON.stringify(appendReplayBatch([],minutes,'1h',true))),hours);
});
test('future extension cannot change visible aggregate prefix',()=>{
  const minutes=Array.from({length:30},(_,i)=>minute(T+i*60000,{high:i>=10?999:102}));
  const days=[{date:'2026-08-19',open:T,close:T+390*60000}];
  const visible=aggregateEquity(minutes.filter(c=>c.closeTime<T+10*60000),'15m',days);
  assert.equal(visible[0].high,102);assert.equal(visible[0].volume,100);assert.equal(visible[0].closeTime,T+10*60000-1);
});
test('calendar plan crosses Labor Day and weekends without fabricated minutes',()=>{
  const a=Date.parse('2026-09-04T19:59:00Z'),b=Date.parse('2026-09-08T13:30:00Z');
  const s=workspace(a);advance(s,[minute(a),minute(b)],2,b+60000,[a,b]);
  assert.equal(s.sessions[0].advancedBars,2);assert.equal(s.sessions[0].cursorTime,b+59999);
});
test('missing, invalid, duplicate, future and unplanned execution is atomic',()=>{
  for(const bars of [[minute(T)], [minute(T),minute(T+60000,{high:90})], [minute(T),minute(T)], [minute(T),minute(T+120000)]]) {
    const s=workspace(T),before=structuredClone(s);assert.throws(()=>advance(s,bars,2,T+120000,[T,T+60000]));assert.deepEqual(s,before);
  }
  assert.throws(()=>advance(workspace(T),[minute(T)],1,T+120000));
  assert.throws(()=>validateEquityMinutes([minute(T)], [T], T+30000));
});
test('v2 ambiguous minute cannot award a partial target before final stop',()=>{
  const s=workspace(T),t=trade();t.takeProfitLevels=[{price:110,amount:50,eligibleTime:T,filled:false}];s.trades=[t];
  applyCandle(s,s.sessions[0],minute(T,{high:115,low:85}));
  assert.equal(t.status,'closed');assert.equal(t.exitReason,'وقف الخسارة');assert.equal(t.partialExits,undefined);assert.ok(t.events.some(e=>e.kind==='ambiguous'));
});
test('v2 partial stop prevents same-minute target credit and executes once',()=>{
  const s=workspace(T),t=trade();t.stopLevels=[{price:95,amount:50,eligibleTime:T,filled:false}];t.takeProfitLevels=[{price:110,amount:50,eligibleTime:T,filled:false}];s.trades=[t];
  applyCandle(s,s.sessions[0],minute(T,{high:115,low:94}));
  assert.equal(t.partialExits.length,1);assert.equal(t.partialExits[0].type,'partial-stop');assert.equal(t.remainingQuantity,.5);
});
test('v2 queued manual exit and scale-in use next opening, preserve historical accounting',()=>{
  const s=workspace(T),t=trade();s.trades=[t];t.pendingScaleIn=100;
  applyCandle(s,s.sessions[0],minute(T,{open:105,high:106,low:104,close:105}));
  assert.ok(t.entryPrice>100);assert.equal(t.pendingScaleIn,undefined);assert.equal(t.notional,200);
  t.status='close_pending';applyCandle(s,s.sessions[0],minute(T+60000,{open:103,high:104,low:102,close:103}));
  assert.equal(t.exitPrice,103*(1-.0002));assert.equal(t.exitTime,T+60000);
  const snapshot=JSON.parse(JSON.stringify(s));assert.deepEqual(normalizeWorkspace(snapshot).trades[0].realizedPnl,t.realizedPnl);
});

async function fixture(fn, rows, dates=[{date:'2026-08-19',open:'09:30',close:'09:32'}], responseOverride) {
  const old=globalThis.fetch, oldKey=process.env.ALPACA_API_KEY,oldSecret=process.env.ALPACA_API_SECRET;
  process.env.ALPACA_API_KEY='test-only';process.env.ALPACA_API_SECRET='test-only';
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push(String(url));assert.equal(options.headers['APCA-API-KEY-ID'],'test-only');
    if(String(url).includes('/calendar')) { const q=new URL(url).searchParams; return Response.json(dates.filter(d=>d.date>=q.get('start')&&d.date<=q.get('end'))); }
    if(responseOverride)return responseOverride(url,calls);
    const q=new URL(url).searchParams; const selected=rows.filter(r=>Date.parse(r.t)>=Date.parse(q.get('start'))&&Date.parse(r.t)<=Date.parse(q.get('end'))); const second=q.has('page_token');return Response.json({bars:second?selected.slice(1):selected.slice(0,1),next_page_token:second?null:'next'});
  };
  try {const api=await import(`../lib/equity-market.ts?test=${Math.random()}`);await fn(api,calls);}
  finally {globalThis.fetch=old;if(oldKey===undefined)delete process.env.ALPACA_API_KEY;else process.env.ALPACA_API_KEY=oldKey;if(oldSecret===undefined)delete process.env.ALPACA_API_SECRET;else process.env.ALPACA_API_SECRET=oldSecret;}
}
const row=(t,extra={})=>({t:new Date(t).toISOString(),o:100,h:102,l:99,c:101,v:10,...extra});
test('provider completes pagination, fixes SIP/raw and caches repeated steps',async()=>{
  await fixture(async(api,calls)=>{
    await api.checkEquityStart('AAPL',T);const before=calls.length;
    const b=await api.equityStep(session(T),2);assert.equal(b.candles.length,2);
    const after=calls.length; await api.equityStep(session(T),2);assert.equal(calls.length,after);assert.ok(after>=before);
    assert.ok(calls.filter(x=>x.includes('/bars?')).every(x=>x.includes('feed=sip')&&x.includes('adjustment=raw')&&x.includes('timeframe=1Min')));
  },[row(T),row(T+60000)]);
});
test('provider rejects duplicate and missing minutes without accepting partial pages',async()=>{
  for(const rows of [[row(T),row(T)],[row(T)]]) await fixture(async(api)=>{await assert.rejects(api.checkEquityStart('AMD',T));},rows);
});
test('provider rejects invalid OHLC and repeated pagination tokens',async()=>{
  await fixture(async(api)=>{await assert.rejects(api.checkEquityStart('NVDA',T));},[row(T,{h:90}),row(T+60000)]);
  await fixture(async(api)=>{await assert.rejects(api.checkEquityStart('NVDA',T),/صفحة/);},[],undefined,()=>Response.json({bars:[],next_page_token:'same'}));
});
test('provider rejects unavailable starts and redacts permission errors',async()=>{
  await fixture(async(api)=>{await assert.rejects(api.checkEquityStart('GOOGL',T-60000),/البداية المقترحة/);await assert.rejects(api.checkEquityStart('GOOGL',Date.UTC(2015,0,1)),/2016/);},[row(T),row(T+60000)]);
  await fixture(async(api)=>{await assert.rejects(api.checkEquityStart('AAPL',T),e=>e.message.includes('403')&&!e.message.includes('private-upstream'));},[],undefined,()=>new Response('private-upstream',{status:403}));
});
test('rate limits retry, network outages fail closed',async()=>{
  let n=0;await fixture(async(api)=>{await api.equityRange('AMD',T,T+119999);assert.equal(n,2);},[],undefined,()=>++n===1?new Response('',{status:429}):Response.json({bars:[row(T),row(T+60000)],next_page_token:null}));
  await fixture(async(api)=>{await assert.rejects(api.checkEquityStart('AMD',T),/انقطع/);},[],undefined,()=>{throw new Error('secret-upstream');});
});

test('timeouts while reading a successful HTTP response retry without leaking details',async()=>{
  let n=0;
  await fixture(async(api)=>{const result=await api.equityRange('AMD',T,T+119999);assert.equal(result.candles.length,2);assert.equal(n,2);},[],undefined,()=>{
    if (++n===1) return {ok:true,json:async()=>{throw new Error('private-body-timeout');}};
    return Response.json({bars:[row(T),row(T+60000)],next_page_token:null});
  });
});
test('equities cannot silently fall back to bundled synthetic data',()=>{
  const pack=JSON.parse(readFileSync(new URL('../data/offline-pack.json',import.meta.url)));
  for(const s of ['AAPL','NVDA','AMD','GOOGL'])assert.equal(pack.symbols[s],undefined);
  for(const s of ['BTCUSDT','ETHUSDT','SOLUSDT','XAUTUSDT','PAXGUSDT'])assert.ok(pack.symbols[s]);
});
