import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import path from "node:path";
import os from "node:os";

const home = os.homedir();

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: path.join(home, ".hlsfy", "hlsfy.db"),
  },
});
