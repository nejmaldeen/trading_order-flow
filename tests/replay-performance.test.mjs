import test from 'node:test';
import assert from 'node:assert/strict';
import {appendReplayBatch,appendReplayCandle} from '../lib/replay.ts';
const start=Date.UTC(2025,0,1);
const minutes=Array.from({length:1440},(_,i)=>({openTime:start+i*60000,closeTime:start+i*60000+59999,open:100,high:103,low:98,close:101,volume:2}));
test('daily batch preserves OHLCV, input and intermediate minute semantics',()=>{
 const history=[{...minutes[0],openTime:start-86400000,closeTime:start-1}];
 const before=structuredClone(history);
 for(const frame of ['1m','15m','4h','1d']){
  const expected=minutes.reduce((v,c)=>appendReplayCandle(v,c,frame),history);
  assert.deepEqual(appendReplayBatch(history,minutes,frame),expected);
 }
 assert.deepEqual(history,before);
 const result=appendReplayBatch(history,minutes,'1d');
 assert.equal(result.length,2);assert.equal(result[1].volume,2880);
 assert.equal(result[1].closeTime,start+86400000-1);
 assert.deepEqual(appendReplayBatch(result,minutes,'1d'),result);
});
