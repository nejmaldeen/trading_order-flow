import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client/node';
import { drizzle } from 'drizzle-orm/libsql/web';
import { and, eq } from 'drizzle-orm';
import { workspaces } from '../db/schema.ts';

test('libSQL preserves owner isolation and atomic compare-and-swap saves',async()=>{
  const client=createClient({url:'file::memory:'});
  try {
    await client.execute('CREATE TABLE trading_workspaces (owner_id TEXT PRIMARY KEY NOT NULL, state_json TEXT NOT NULL, updated_at TEXT NOT NULL)');
    const db=drizzle(client);
    const a={ownerId:'owner-a',stateJson:'{"revision":0}',updatedAt:'now'};
    assert.equal((await db.insert(workspaces).values(a).onConflictDoNothing().returning()).length,1);
    assert.equal((await db.insert(workspaces).values(a).onConflictDoNothing().returning()).length,0);
    assert.equal((await db.select().from(workspaces).where(eq(workspaces.ownerId,'owner-b'))).length,0);
    const update=()=>db.update(workspaces).set({stateJson:'{"revision":1}'}).where(and(eq(workspaces.ownerId,a.ownerId),eq(workspaces.stateJson,a.stateJson))).returning();
    assert.equal((await update()).length,1);assert.equal((await update()).length,0);
    assert.equal((await db.select().from(workspaces).where(eq(workspaces.ownerId,a.ownerId)))[0].stateJson,'{"revision":1}');
  } finally {client.close();}
});
