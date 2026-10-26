import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const base=process.env.QA_LAB_URL;
test('isolated HTTP contract: crypto, races, repeat requests and failed writes', {skip:!base,timeout:120000},async()=>{
  assert.equal(process.env.QA_ISOLATED_DB,'yes');assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
  const headers={'Content-Type':'application/json','oai-authenticated-user-id':`audit-${randomUUID()}`};
  const get=async()=> (await (await fetch(base+'/api/lab',{headers})).json()).state;
  const post=async(body)=>{const r=await fetch(base+'/api/lab',{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  let state=await get();
  const summary=(await (await fetch(base+'/api/lab?offlineSummary=1',{headers})).json()).summary;
  for(const symbol of ['BTCUSDT','ETHUSDT','SOLUSDT','XAUTUSDT']) {
    const bounds=summary.symbols[symbol].timeframes['1m'];
    const startTime=bounds.start+60*60000;
    let r=await post({revision:state.revision,action:'start',symbol,startTime,offline:true,timeframe:'1m'});
    assert.equal(r.status,200,r.body.error);state=r.body.state;
    const body={revision:state.revision,action:'step',count:1,unit:'minute',timeframe:'1m'};
    const results=await Promise.all([post(body),post(body)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    state=results.find(r=>r.status===200).body.state;
    assert.equal(state.sessions.find(s=>s.id===state.activeSessionId).cursorTime,startTime+59999);
    assert.equal((await post(body)).status,409);assert.deepEqual(await get(),state);
    const failed=await post({revision:state.revision,action:'buy',notional:99999,stopLoss:1,takeProfit:1e9});
    assert.equal(failed.status,400);assert.deepEqual(await get(),state);
  }
});

const privateBase=process.env.QA_PRIVATE_URL;
test('isolated private HTTP: origin, cookies, logout, throttling and protected routes',{skip:!privateBase,timeout:120000},async()=>{
  assert.equal(process.env.QA_ISOLATED_DB,'yes');assert.ok(['localhost','127.0.0.1'].includes(new URL(privateBase).hostname));
  const send=async(path,options={})=>{
    for(let attempt=0;;attempt++) {
      const result=await fetch(privateBase+path,{redirect:'manual',...options});
      if(attempt<2 && result.status===503 && (await result.clone().text()).includes('worker restarted mid-request')) {
        console.log('QA development worker restarted; retrying authentication probe only.');continue;
      }
      return result;
    }
  };
  for(const path of ['/api/lab','/api/news?cursor=1']) assert.equal((await send(path,{headers:{'oai-authenticated-user-id':'personal-owner'}})).status,401);
  const login=(origin,password)=>send('/api/auth',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({password})});
  assert.equal((await login('https://foreign.example','wrong')).status,403);
  const result=await login(privateBase,'isolated-qa-only-not-a-real-password');assert.equal(result.status,303,await result.clone().text());
  const cookie=result.headers.get('set-cookie').split(';')[0];assert.match(result.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  assert.equal((await send('/api/lab',{headers:{cookie}})).status,200);
  assert.equal((await send('/api/lab',{method:'POST',headers:{cookie,Origin:'https://foreign.example','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await send('/api/webhook/signals',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const out=await send('/api/auth',{method:'POST',headers:{cookie,Origin:privateBase},body:new URLSearchParams({action:'logout'})});assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
  const responses=await Promise.all(Array.from({length:12},()=>login(privateBase,'wrong')));
  assert.ok(responses.some(r=>r.status===429));
  console.log('Private HTTP origin/cookie/logout/throttle checks passed; no credentials logged.');
});
