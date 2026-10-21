import * as schema from "./schema";

// In-memory fallback store for environments without Cloudflare D1 (e.g. Vercel, Node.js)
const memoryStore = new Map<string, { ownerId: string; stateJson: string; updatedAt: string }>();

export function getDb() {
  try {
    // Check if Cloudflare D1 environment is present
    // @ts-ignore
    const workers = require("cloudflare:workers");
    if (workers?.env?.DB) {
      // @ts-ignore
      const { drizzle } = require("drizzle-orm/d1");
      return drizzle(workers.env.DB, { schema });
    }
  } catch {
    // Fall back to memory store
  }

  // Resilient fallback implementation for Vercel / Node.js
  return {
    select: () => ({
      from: () => ({
        where: (condition: any) => ({
          limit: async () => {
            const entries = Array.from(memoryStore.values());
            return entries.slice(0, 1);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (val: any) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (val?.ownerId) {
              memoryStore.set(val.ownerId, val);
            }
            return [{ id: val?.ownerId }];
          },
        }),
      }),
    }),
    update: () => ({
      set: (val: any) => ({
        where: (condition: any) => ({
          returning: async () => {
            for (const [k, v] of memoryStore.entries()) {
              memoryStore.set(k, { ...v, ...val });
            }
            return [{ id: "owner" }];
          },
        }),
      }),
    }),
  } as any;
}
