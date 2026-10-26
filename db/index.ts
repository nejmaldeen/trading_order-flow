import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// Never report successful durable writes using serverless process memory.

export function getDb() {
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

  throw new Error("Durable session storage unavailable: configure the Cloudflare D1 DB binding. No session was saved to temporary memory.");
}
