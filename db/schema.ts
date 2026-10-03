import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("trading_workspaces", {
  ownerId: text("owner_id").primaryKey(),
  stateJson: text("state_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const newsArchive = sqliteTable("news_archive", {
  cacheKey: text("cache_key").primaryKey(),
  payload: text("payload").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});
