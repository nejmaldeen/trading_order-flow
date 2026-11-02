import test from 'node:test';
import assert from 'node:assert/strict';
import {filingEvents} from '../lib/company-news.ts';
test('SEC events use acceptance time, withhold future content and identify earnings',()=>{
 const time=Date.parse('2026-08-19T20:05:00Z');
 const rows={accessionNumber:['0000320193-26-000020'],acceptanceDateTime:[new Date(time).toISOString()],form:['8-K'],primaryDocument:['report.htm'],items:['2.02,9.01']};
 assert.equal(filingEvents('AAPL','0000320193',rows,time-1,24).length,0);
 const [e]=filingEvents('AAPL','0000320193',rows,time,24);assert.equal(e.time,time);assert.match(e.title,/نتائج/);assert.match(e.source,/320193\/000032019326000020\/report.htm$/);assert.match(e.summary,/لا تتوفر خلاصة/);
 assert.equal(filingEvents('AAPL','0000320193',rows,time+25*3600000,24).length,0);
 assert.equal(filingEvents('AAPL','0000320193',{...rows,acceptanceDateTime:['2026-08-19T20:05:00']},time,24).length,0);
});
