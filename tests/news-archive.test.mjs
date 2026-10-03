import test from 'node:test';
import assert from 'node:assert/strict';
import {easternTime,releaseLinks,parseRelease,collectMonth,selectNews,monthsFor} from '../lib/news-archive.ts';
import {readFileSync} from 'node:fs';
test('Eastern release time handles summer, winter and DST transition',()=>{
 assert.equal(easternTime(2026,8,12,8,30),Date.parse('2026-08-12T12:30Z'));
 assert.equal(easternTime(2026,1,13,8,30),Date.parse('2026-01-13T13:30Z'));
 assert.equal(easternTime(2026,3,6,8,30),Date.parse('2026-03-06T13:30Z'));
 assert.equal(easternTime(2026,3,9,8,30),Date.parse('2026-03-09T12:30Z'));
});
test('selects publication month, deduplicates links and ignores latest/revised pages',()=>{
 const link='/news.release/archives/cpi_08122026.htm';
 assert.deepEqual(releaseLinks(link+' '+link+' /news.release/archives/cpi_01132026.htm /news.release/cpi.htm','cpi','2026-08'),['https://www.bls.gov'+link]);
});
test('parser accepts original embargo numbering and rejects missing timestamp',()=>{
 const text='Transmission of material in this release is embargoed until USDL-26-1291 8:30 a.m. (ET) Friday, August 7, 2026 Both nonfarm payroll employment (-23,000) and the unemployment rate changed little. This news release';
 const url='https://www.bls.gov/news.release/archives/empsit_08072026.htm';
 assert.equal(parseRelease(text,url).time,Date.parse('2026-08-07T12:30Z'));
 assert.throws(()=>parseRelease('access denied',url));
});
test('exact cutoff hides future events; rewind and window exclude unrelated news',()=>{
 const t=Date.parse('2026-08-20T04:10Z');
 const a={id:'a',time:t,title:'report',source:'source',summary:'summary'},old={...a,id:'old',time:Date.parse('2026-01-09')};
 assert.deepEqual(selectNews([a,old],t-1,24),[]);
 assert.deepEqual(selectNews([a,a,old],t,24),[a]);
 assert.deepEqual(selectNews([a],t+86400001,24),[]);
});
test('cross-month windows include both months',()=>{
 assert.deepEqual(monthsFor(Date.parse('2026-09-01T06:00Z'),24),['2026-08','2026-09']);
});
test('source errors never become successful empty coverage',async()=>{
 await assert.rejects(collectMonth('cpi','2026-08',async()=>{throw new Error('403')}),/403/);
 await assert.rejects(collectMonth('cpi','2026-08',async()=>'<html>blocked</html>'),/أرشفة|مؤرشفة/);
});
test('persisted archive spans years, retains source dates and hides August future releases',()=>{
 const archive=JSON.parse(readFileSync(new URL('../data/news-archive.json',import.meta.url)));
 assert.ok(Object.keys(archive.months).length>300);
 for(const [key,value] of Object.entries(archive.months))for(const event of value.records){
  assert.ok(Number.isSafeInteger(event.time));assert.equal(new Date(event.time).toISOString().slice(0,7),key.split(':')[1]);
  assert.ok(/^https:\/\/www\.(bls\.gov|federalreserve\.gov)\//.test(event.source));
 }
 const august=archive.months['cpi:2026-08'].records;
 assert.equal(selectNews(august,Date.parse('2026-08-12T12:29:59Z'),168).length,0);
 assert.equal(selectNews(august,Date.parse('2026-08-12T12:30:00Z'),168).length,1);
});
