import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTH_COOKIE, AUTH_TTL, sessionToken, validSession, passwordMatches, requestOwner, sameOrigin} from '../lib/personal-auth.ts';

test('private access rejects missing and short configuration', () => {
  const previous=process.env.TRADING_LAB_PASSWORD;
  try {
    delete process.env.TRADING_LAB_PASSWORD;
    assert.equal(passwordMatches('anything'),false);assert.throws(()=>sessionToken());
    process.env.TRADING_LAB_PASSWORD='short';assert.equal(passwordMatches('short'),false);
  } finally {if(previous===undefined)delete process.env.TRADING_LAB_PASSWORD;else process.env.TRADING_LAB_PASSWORD=previous;}
});
test('signed session expires, resists tampering and is revoked by password rotation',()=>{
  const previous=process.env.TRADING_LAB_PASSWORD;
  try {
    process.env.TRADING_LAB_PASSWORD='test-only-long-password-123456';
    const now=Date.now(),token=sessionToken(now);
    assert.equal(passwordMatches('test-only-long-password-123456'),true);
    assert.equal(passwordMatches('wrong'),false);
    assert.equal(validSession(token,now),true);
    assert.equal(validSession(token,now+AUTH_TTL*1000),false);
    assert.equal(validSession(token.slice(0,-1)+(token.endsWith('0')?'1':'0'),now),false);
    process.env.TRADING_LAB_PASSWORD='another-test-password-654321';assert.equal(validSession(token,now),false);
  } finally {if(previous===undefined)delete process.env.TRADING_LAB_PASSWORD;else process.env.TRADING_LAB_PASSWORD=previous;}
});
test('public hosting never accepts forged Sites identity; valid cookie is required',()=>{
  const old={password:process.env.TRADING_LAB_PASSWORD,vercel:process.env.VERCEL};
  try {
    process.env.VERCEL='1';process.env.TRADING_LAB_PASSWORD='test-only-long-password-123456';
    const h=new Headers({'oai-authenticated-user-id':'victim'});
    assert.equal(requestOwner(h),null);
    h.set('cookie',`${AUTH_COOKIE}=${sessionToken()}`);assert.equal(requestOwner(h),'personal-owner');
  } finally {for(const [key,value] of [['TRADING_LAB_PASSWORD',old.password],['VERCEL',old.vercel]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
test('login rejects foreign and absent origins',()=>{
  assert.equal(sameOrigin(new Request('https://lab.example/api/auth',{headers:{origin:'https://lab.example'}})),true);
  assert.equal(sameOrigin(new Request('https://lab.example/api/auth',{headers:{origin:'https://attacker.example'}})),false);
  assert.equal(sameOrigin(new Request('https://lab.example/api/auth')),false);
  assert.equal(sameOrigin(new Request('http://localhost:5182/api/auth',{headers:{host:'127.0.0.1:5182',origin:'http://127.0.0.1:5182'}})),true);
});
