import { drizzle } from "drizzle-orm/d1";
import { drizzle as drizzleRemote } from "drizzle-orm/libsql/web";
import { createClient } from "@libsql/client/web";
import * as schema from "./schema";

// Never report successful durable writes using serverless process memory.

let remote: ReturnType<typeof drizzleRemote<typeof schema>> | undefined;
let ready: Promise<void> | undefined;
export async function getDb() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    if (!remote) {
      const client = createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
      remote = drizzleRemote(client, {schema});
      // Idempotent initialization of the existing session schema only. No market archive.
      ready = client.batch([
        'CREATE TABLE IF NOT EXISTS trading_workspaces (owner_id TEXT PRIMARY KEY NOT NULL, state_json TEXT NOT NULL, updated_at TEXT NOT NULL)',
      ], 'write').then(() => {}).catch(() => { remote=undefined; throw new Error('تعذر تهيئة تخزين الجلسات؛ تحقق من ربط قاعدة البيانات.'); });
    }
    await ready;
    return remote!;
  }
  try {
    // Check if Cloudflare D1 environment is present
    // @ts-ignore
    const workers = require("cloudflare:workers");
    if (workers?.env?.DB) {
      return drizzle(workers.env.DB, { schema });
    }
  } catch {
    // Fail closed below when the durable binding is unavailable.
  }

  throw new Error("Durable session storage unavailable: configure Turso credentials or the Cloudflare D1 DB binding. No session was saved to temporary memory.");
}
