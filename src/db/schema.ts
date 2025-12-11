import { sql } from "drizzle-orm";
import {
  AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const transcodes = sqliteTable("transcodes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id"),
  inputFileSource: text("input_file_source")
    .$type<"URL" | "STORAGE">()
    .notNull(),
  inputFileUrl: text("input_file_url"),
  inputFileKey: text("input_file_key"),
  inputStorage: text("input_storage"), // stringified JSON with the storage details
  createdAt: integer("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const transcodeSessions = sqliteTable("transcode_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transcodeId: integer("transcode_id")
    .notNull()
    .references(() => transcodes.id),
  status: text("status").$type<"ACTIVE" | "EXPIRED">().notNull(),
  homeFolder: text("home_folder").notNull(),
  sourceFilePath: text("source_file_path").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const transcodeActions = sqliteTable("transcode_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transcodeId: integer("transcode_id")
    .notNull()
    .references(() => transcodes.id),
  action: text("action").notNull(),
  payload: text("payload"), // stringified JSON with the payload
  maxAttempts: integer("max_attempts").notNull(),
  delay: integer("delay").notNull(),
  currentAttempt: integer("current_attempt").notNull().default(0),
  payloadFromActionId: integer("payload_from_action_id").references(
    (): AnySQLiteColumn => transcodeActions.id,
  ),
  externalId: text("external_id"),
  status: text("status")
    .$type<"PENDING" | "RUNNING" | "COMPLETED" | "FAILED">()
    .notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const transcodeActionOutputs = sqliteTable("transcode_action_outputs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id"),
  transcodeActionId: integer("transcode_action_id")
    .notNull()
    .references(() => transcodeActions.id),
  output: text("output").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
