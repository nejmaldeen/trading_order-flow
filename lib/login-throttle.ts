import { sql } from 'drizzle-orm';
import { loginAttempts } from '../db/schema.ts';
import type { getDb } from '../db/index';

// A single atomic, bounded row shared by serverless instances. No IP addresses
// or credentials are retained. Database failure must fail closed at the caller.
export async function allowLoginAttempt(db: Awaited<ReturnType<typeof getDb>>, now = Date.now()) {
  const cutoff=now-60000;
  const rows=await db.insert(loginAttempts).values({id:'personal-login',windowStart:now,attempts:1}).onConflictDoUpdate({
    target:loginAttempts.id,
    set:{
      windowStart:sql`case when ${loginAttempts.windowStart} <= ${cutoff} then ${now} else ${loginAttempts.windowStart} end`,
      attempts:sql`case when ${loginAttempts.windowStart} <= ${cutoff} then 1 else min(${loginAttempts.attempts} + 1, 11) end`,
    },
  }).returning();
  return rows[0]?.attempts<=10;
}
