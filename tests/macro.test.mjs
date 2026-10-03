import test from 'node:test';
import assert from 'node:assert/strict';
import {macroAt} from '../lib/macro.ts';
test('unknown schedules and future results never leave the server',()=>{
 assert.equal(macroAt(Date.parse('2024-01-01')).events.length,0);
 const early=macroAt(Date.parse('2026-01-02T05:00:00Z'));
 assert.equal(early.events.length,3);
 assert.ok(early.events.every(e=>e.status==='upcoming'&&!('summary' in e)));
 assert.ok(!JSON.stringify(early).includes('50 ألف'));
 assert.ok(!JSON.stringify(early).includes('empsit_01092026'));
});
test('release appears at the precise UTC timestamp and rewinding hides it',()=>{
 const t=Date.parse('2026-01-09T13:30:00Z');
 assert.equal(macroAt(t-1).events[0].summary,undefined);
 assert.match(macroAt(t).events[0].summary,/50 ألف/);
 assert.equal(macroAt(t-1).events[0].status,'upcoming');
});
test('large replay jumps retain every released event with original values',()=>{
 const data=macroAt(Date.parse('2026-01-29T00:00:00Z'));
 assert.equal(data.events.filter(e=>e.status==='released').length,3);
 assert.match(data.events[1].summary,/2.7%/);
 assert.match(data.coverage,/محدودة/);
});
test('January releases are never presented as August news',()=>{
 assert.equal(macroAt(Date.parse('2026-08-20')).events.length,0);
});
