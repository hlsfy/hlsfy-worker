import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export const HOME = path.join(os.homedir(), ".hlsfy");

if (!fs.existsSync(HOME)) {
  fs.mkdirSync(HOME, { recursive: true });
}

export const DB_PATH = path.join(HOME, "worker.db");
