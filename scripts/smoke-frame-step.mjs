import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
let state=(await fetch(base+'/api/lab').then(r=>r.json())).state;
async function post(body){const r=await fetch(base+'/api/lab',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,revision:state.revision}),signal:AbortSignal.timeout(120000)});const p=await r.json();assert.equal(r.status,200,JSON.stringify(p));state=p.state;return p;}
await post({action:'start',symbol:'BTCUSDT',startTime:Date.UTC(2025,0,1,9),timeframe:'15m',confirmReplace:true});
const session=()=>state.sessions.find(s=>s.id===state.activeSessionId);
for(const [timeframe,minutes] of [['1m',1],['5m',5],['15m',15],['1h',60],['4h',240],['1d',1440]]){
 const before=session().cursorTime,revision=state.revision;
 const result=await post({action:'step',unit:'bar',timeframe});
 assert.equal(session().cursorTime-before,minutes*60000);
 assert.equal(state.revision,revision+1);
 assert.equal(result.candles.length,minutes);
 assert.ok(result.candles.every((c,i)=>c.openTime===before+1+i*60000&&c.closeTime<=session().cursorTime));
 console.log(`${timeframe}: ${minutes} minutes, one atomic revision, no future candles`);
}
const before=session().cursorTime;
await post({action:'step',count:1,timeframe:'1d'});
assert.equal(session().cursorTime-before,60000);
console.log('Legacy minute playback preserved.');
