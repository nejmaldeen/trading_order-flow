import test from 'node:test';
import assert from 'node:assert/strict';
import { equityRange, equityStep, checkEquityStart, aggregateEquity, newYorkTime, validateEquityMinutes } from '../lib/equity-market.ts';

test('live read-only SIP qualification and warm-cache benchmark', {skip:process.env.QA_LIVE_SIP!=='yes',timeout:600000},async(t)=>{
  const original=globalThis.fetch;let requests=0,pages=0;
  globalThis.fetch=async(...args)=>{requests++;if(String(args[0]).includes('/bars?'))pages++;return original(...args);};
  try {
    for(const symbol of ['AAPL','NVDA','AMD','GOOGL']) for(const date of ['2026-08-19','2026-09-08','2026-10-15']) {
      await t.test(`${symbol} ${date}`,async()=>{
      const open=newYorkTime(date,'09:30'),close=newYorkTime(date,'16:00');
      const before=requests,pageBefore=pages,started=performance.now();
      const data=await equityRange(symbol,open,close-1);
      validateEquityMinutes(data.candles,Array.from({length:390},(_,i)=>open+i*60000));
      const coldMs=performance.now()-started;
      const session={id:'qa',symbol,startTime:open,cursorTime:open-1,advancedBars:0,engineVersion:2,dataSource:'alpaca-sip-raw'};
      const warmBefore=requests,warm=performance.now();
      for(const frame of ['1m','5m','15m','1h','4h','1d']) {
        const step=await equityStep(session,1,frame);
        assert.equal(step.count,{'1m':1,'5m':5,'15m':15,'1h':60,'4h':240,'1d':390}[frame]);
        assert.deepEqual(aggregateEquity(step.candles,frame,data.sessions)[0],aggregateEquity(data.candles.slice(0,step.count),frame,data.sessions)[0]);
      }
      console.log(JSON.stringify({symbol,date,minutes:data.candles.length,requests:requests-before,pages:pages-pageBefore,coldMs:Math.round(coldMs),sixStepsMs:Math.round(performance.now()-warm),warmRequests:requests-warmBefore,heapMiB:Math.round(process.memoryUsage().heapUsed/1048576)}));
      });
    }
    for(const [date,time] of [['2026-08-19','09:29'],['2026-08-19','16:00'],['2026-09-07','09:30']]) await assert.rejects(checkEquityStart('AAPL',newYorkTime(date,time)));
  } finally {globalThis.fetch=original;}
});
