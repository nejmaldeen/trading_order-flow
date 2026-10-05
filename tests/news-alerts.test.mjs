import test from 'node:test';
import assert from 'node:assert/strict';
import {crossedNews} from '../lib/news-alerts.ts';
import {parseRelease,selectNews,releaseLinks} from '../lib/news-archive.ts';
test('PPI original release timestamp and content are parsed',()=>{
 const url='https://www.bls.gov/news.release/archives/ppi_08142025.htm';
 const r=parseRelease('embargoed until 8:30 a.m. (ET) Thursday, August 14, 2025 The Producer Price Index for final demand rose 0.9 percent. Final Demand',url);
 assert.equal(r.time,Date.parse('2025-08-14T12:30Z'));assert.match(r.title,/PPI/);assert.match(r.summary,/0.9/);
 assert.equal(selectNews([r],r.time-1,24).length,0);assert.equal(selectNews([r],r.time,24).length,1);
 assert.deepEqual(releaseLinks(url,'ppi','2025-08'),[url]);
});
test('sound only crosses release: no initial, future, duplicate or rewind alerts',()=>{
 const e={id:'ppi',time:100};
 assert.deepEqual(crossedNews([e],null,200),[]);
 assert.deepEqual(crossedNews([e],50,99),[]);
 assert.deepEqual(crossedNews([e,e],99,100),[e]);
 assert.deepEqual(crossedNews([e],100,150),[]);
 assert.deepEqual(crossedNews([e],150,50),[]);
 assert.deepEqual(crossedNews([e],50,200),[e]);
});
