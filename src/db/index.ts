import "dotenv/config";
import { drizzle } from "drizzle-orm/bun-sqlite";
import fs from "node:fs";
import { Database } from "bun:sqlite";
import path from "node:path";
import { DB_PATH } from "../constants";

const dbDir = path.dirname(DB_PATH);
fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA synchronous = NORMAL;");
sqlite.exec("PRAGMA busy_timeout = 5000;");

const db = drizzle({ client: sqlite });

export { db, sqlite };
