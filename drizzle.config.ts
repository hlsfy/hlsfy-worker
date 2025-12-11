import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DB_PATH } from "./src/constants";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: DB_PATH,
  },
});
