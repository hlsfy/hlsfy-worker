import "dotenv/config";

import { Elysia } from "elysia";
import z from "zod";
import { transcodeApp } from "./transcode";
import { db } from "./db";
import path from "path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const token = process.env.TOKEN;
const port = process.env.PORT || 9856;

if (!token) {
  console.error("TOKEN is not set");
  process.exit(1);
}

const tokenAuth = new Elysia({ name: "tokenAuth" }).macro({
  tokenAuth: () => ({
    beforeHandle(params) {
      const authorization = params?.request?.headers?.get("authorization");
      const headerToken = authorization?.split(" ")?.[1]?.trim();

      if (headerToken !== token) {
        throw new Error("Unauthorized");
      }
    },
  }),
});

function runMigrations() {
  const drizzleFolder = path.join(__dirname, "..", "drizzle");

  migrate(db, {
    migrationsFolder: drizzleFolder,
  });
}

runMigrations();

const app = new Elysia()
  .use(tokenAuth)
  .get(
    "/health",
    () => {
      return {
        message: "OK",
      } as const;
    },
    {
      tokenAuth: true,
      response: {
        200: z.object({
          message: z.literal("OK"),
        }),
      },
    }
  )
  .use(transcodeApp)
  .listen(port);

export type App = typeof app;

console.log("RUNNING");
