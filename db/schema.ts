import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("trading_workspaces", {
  ownerId: text("owner_id").primaryKey(),
  stateJson: text("state_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});
