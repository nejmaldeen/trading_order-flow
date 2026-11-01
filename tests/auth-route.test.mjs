import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createClient} from '@libsql/client/node';
import {drizzle} from 'drizzle-orm/libsql/web';
import {validSession} from '../lib/personal-auth.ts';

// Exercise the real route with only its storage boundary replaced by isolated
// in-memory libSQL. No server credentials, user database or HTTP are involved.
test('private login route enforces body/origin limits, persistent throttle and cookie lifecycle',async()=>{
  const previous={VERCEL:process.env.VERCEL,TRADING_LAB_PASSWORD:process.env.TRADING_LAB_PASSWORD};
  const client=createClient({url:'file::memory:'});
  const slot='__isolatedAuthDb';
  try {
    process.env.VERCEL='1';process.env.TRADING_LAB_PASSWORD='isolated-route-test-password-only';
    await client.execute('CREATE TABLE login_attempts (id TEXT PRIMARY KEY NOT NULL,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL)');
    globalThis[slot]=drizzle(client);
    let source=readFileSync(new URL('../app/api/auth/route.ts',import.meta.url),'utf8');
    source=source.replace("import { getDb } from '@/db';",`const getDb=async()=>globalThis.${slot};`);
    for(const name of ['personal-auth','login-throttle'])source=source.replace(`@/lib/${name}`,new URL(`../lib/${name}.ts`,import.meta.url).href);
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
    const load=()=>import('data:text/javascript;base64,'+Buffer.from(code+'\n//'+Math.random()).toString('base64'));
    const {POST}=await load();
    const request=(password,origin='https://qa.example')=>new Request('https://qa.example/api/auth',{method:'POST',headers:{origin},body:new URLSearchParams({password})});
    assert.equal((await POST(request('wrong','https://foreign.example'))).status,403);
    assert.equal((await POST(new Request('https://qa.example/api/auth',{method:'POST',body:'x'}))).status,403);
    assert.equal((await POST(request('x'.repeat(5000)))).status,413);
    const response=await POST(request(process.env.TRADING_LAB_PASSWORD));assert.equal(response.status,303);
    const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Strict; Secure/);
    assert.equal(validSession(cookie.split(';')[0].split('=')[1]),true);
    const fresh=await load();
    for(let i=0;i<9;i++)assert.equal((await fresh.POST(request(process.env.TRADING_LAB_PASSWORD))).status,303);
    assert.equal((await POST(request(process.env.TRADING_LAB_PASSWORD))).status,429);
    const logout=await POST(new Request('https://qa.example/api/auth',{method:'POST',headers:{origin:'https://qa.example'},body:new URLSearchParams({action:'logout'})}));
    assert.equal(logout.status,303);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
    globalThis[slot]=null;assert.equal((await POST(request('wrong'))).status,503);
  } finally {
    delete globalThis[slot];client.close();
    for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
