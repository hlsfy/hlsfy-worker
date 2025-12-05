import "dotenv/config";

import { Elysia } from "elysia";
import z from "zod";

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
  .listen(port);

export type App = typeof app;

console.log("RUNNING");
