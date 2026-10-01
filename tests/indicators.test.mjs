import test from 'node:test';
import assert from 'node:assert/strict';
import {indicatorValues} from '../lib/indicators.ts';
const candles=[1,2,3,4,5].map((close,i)=>({openTime:i*60000,close}));
test('SMA warms up and uses trailing candles',()=>{assert.deepEqual(indicatorValues(candles,3,'sma').map(v=>v.value),[2,3,4]);});
test('EMA initializes with SMA then uses exponential weighting',()=>{assert.deepEqual(indicatorValues(candles,3,'ema').map(v=>v.value),[2,3,4]);});
test('bands use population deviation and stay centered',()=>{const v=indicatorValues(candles,3,'bands')[0];assert.ok(Math.abs(v.upper-(2+2*Math.sqrt(2/3)))<1e-10);assert.equal(v.upper+v.lower,4);});
test('future candles cannot alter earlier indicator points',()=>{for(const kind of ['sma','ema','bands'])assert.deepEqual(indicatorValues(candles,3,kind),indicatorValues([...candles,{openTime:300000,close:999999}],3,kind).slice(0,-1));});
test('invalid periods and insufficient history yield no points',()=>{assert.deepEqual(indicatorValues(candles,0,'sma'),[]);assert.deepEqual(indicatorValues(candles,20,'ema'),[]);});
