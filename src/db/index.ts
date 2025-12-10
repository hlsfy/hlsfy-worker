import "dotenv/config";
import { drizzle } from "drizzle-orm/bun-sqlite";
import fs from "node:fs";
import { Database } from "bun:sqlite";
import os from "node:os";
import path from "node:path";

const home = os.homedir();
const dbPath = path.join(home, ".hlsfy", "hlsfy.db");

const dbDir = path.dirname(dbPath);
fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA synchronous = NORMAL;");
sqlite.exec("PRAGMA busy_timeout = 5000;");

const db = drizzle({ client: sqlite });

export { db, sqlite };
