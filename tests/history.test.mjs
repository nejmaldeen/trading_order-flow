import test from 'node:test';
import assert from 'node:assert/strict';
import {olderHistory,HISTORY_PAGE_SIZE,HISTORY_START,chartHistory} from '../lib/market-data.ts';
import {appendReplayCandle,DURATIONS} from '../lib/replay.ts';
const before=Date.UTC(2025,0,1);
const session={id:'s',symbol:'BTCUSDT',cursorTime:before-1,startTime:before,advancedBars:0,createdAt:''};
const bar=(time,duration=60000)=>({openTime:time,closeTime:time+duration-1,open:100,high:102,low:99,close:101,volume:10});
const provider=async(_symbol,tf,start,end)=>({source:'fixture',candles:Array.from({length:Math.floor((end-start+1)/DURATIONS[tf])},(_,i)=>bar(start+i*DURATIONS[tf],DURATIONS[tf]))});
test('older pages are consecutive, nonoverlapping and never execute or move Replay',async()=>{
 const saved=structuredClone(session);
 const page=await olderHistory(session,'1m',before,provider);
 const previous=await olderHistory(session,'1m',page.candles[0].openTime,provider);
 assert.equal(page.candles.length,HISTORY_PAGE_SIZE);
 assert.equal(previous.candles.at(-1).closeTime+1,page.candles[0].openTime);
 assert.deepEqual(session,saved);
 assert.ok([...page.candles,...previous.candles].every(c=>c.closeTime<=session.cursorTime));
});
test('future and unaligned paging boundaries are rejected',async()=>{
 await assert.rejects(olderHistory(session,'1m',before+60000,provider));
 await assert.rejects(olderHistory(session,'1m',before-1,provider));
});
test('paging filters extra future rows and rejects missing endpoint',async()=>{
 const page=await olderHistory(session,'1m',before,async(...args)=>{const r=await provider(...args);return {...r,candles:[...r.candles,bar(before)]};});
 assert.equal(page.candles.at(-1).closeTime,before-1);
 await assert.rejects(olderHistory(session,'1m',before,async(...args)=>{const r=await provider(...args);return {...r,candles:r.candles.slice(0,-1)};}),/فجوة/);
});
test('earliest boundary ends paging without a network request',async()=>{
 const page=await olderHistory(session,'1m',HISTORY_START,async()=>{throw Error('must not fetch');});
 assert.equal(page.hasMore,false);assert.deepEqual(page.candles,[]);
});
test('initial history is larger and advancing preserves all loaded candles',async()=>{
 const history=await chartHistory(session,'1m',provider);
 assert.equal(history.candles.length,HISTORY_PAGE_SIZE-1);
 let candles=Array.from({length:1200},(_,i)=>bar(before-(1200-i)*60000));
 candles=appendReplayCandle(candles,bar(before),'1m');
 assert.equal(candles.length,1201);assert.equal(candles[0].openTime,before-1200*60000);
});
test('failure does not masquerade as end of available history',async()=>{
 await assert.rejects(olderHistory(session,'1m',before,async()=>({source:'fixture',candles:[]})),/أعد المحاولة/);
});
