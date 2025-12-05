import "dotenv/config";

import { Elysia } from "elysia";

const token = process.env.TOKEN;

if (!token) {
  console.error("TOKEN is not set");
  process.exit(1);
}

const tokenAuth = new Elysia({ name: "tokenAuth" }).macro({
  tokenAuth: () => ({
    beforeHandle({ headers }) {
      const authorization =
        headers["authorization"] || headers["Authorization"];

      if (authorization !== `Bearer ${token}`) {
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
      };
    },
    {
      tokenAuth: true,
    }
  )
  .listen(9856);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
