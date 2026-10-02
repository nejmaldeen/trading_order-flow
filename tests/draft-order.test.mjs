import test from 'node:test';
import assert from 'node:assert/strict';
import {draftOrderType,draftError} from '../lib/draft-order.ts';

test('dragging entry chooses correct future order for both directions',()=>{
  assert.equal(draftOrderType('long',100,100),'market');
  assert.equal(draftOrderType('long',90,100),'limit');
  assert.equal(draftOrderType('long',110,100),'stop');
  assert.equal(draftOrderType('short',110,100),'limit');
  assert.equal(draftOrderType('short',90,100),'stop');
});
test('confirmation validates cash including fees and directional levels',()=>{
  assert.equal(draftError(100,100,90,120,'long',1000),null);
  assert.equal(draftError(100,100,110,80,'short',1000),null);
  assert.ok(draftError(100,100,90,120,'long',100));
  assert.ok(draftError(100,100,110,80,'long',1000));
  assert.ok(draftError(100,100,90,120,'short',1000));
  assert.ok(draftError(100,0,90,120,'long',1000));
  assert.ok(draftError(NaN,100,90,120,'long',1000));
});
