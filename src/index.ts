import "dotenv/config";

import { Elysia } from "elysia";

const token = process.env.TOKEN;
const port = process.env.PORT || 9856;

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
  .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
