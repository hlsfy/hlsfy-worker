import { Elysia } from "elysia";
import z from "zod";
import { db } from "./db";
import * as schema from "./db/schema";
import { and, eq, notInArray } from "drizzle-orm";
import { createAction } from "./actions/utils";
import { parseDbDate } from "./utils";

const transcodeApp = new Elysia({ name: "transcode" });

transcodeApp.post(
  "/transcode",
  async ({ body }) => {
    if (body.inputFileSource === "URL" && !body.inputFileUrl) {
      throw new Error("inputFileUrl is required");
    }

    if (body.inputFileSource === "STORAGE" && !body.storage) {
      throw new Error("storage is required");
    }

    const [createdTranscode] = await db
      .insert(schema.transcodes)
      .values({
        externalId: body.id,
        inputFileSource: body.inputFileSource,
        inputFileUrl: body.inputFileUrl,
        inputFileKey: body.inputFileKey,
        inputStorage: body.storage ? JSON.stringify(body.storage) : null,
      })
      .returning();

    return {
      id: createdTranscode.id,
    };
  },
  {
    tokenAuth: true,
    body: z.object({
      id: z.string(),
      inputFileSource: z.enum(["URL", "STORAGE"]),
      inputFileUrl: z.string().optional().nullable(),
      inputFileKey: z.string().optional().nullable(),
      storage: z.any().optional().nullable(),
    }),
    response: z.object({
      id: z.number(),
    }),
  },
);

transcodeApp.post(
  "/transcode/:id/actions",
  async ({ params, body }) => {
    const { id: paramId } = params;
    const id = Number(paramId);

    const [transcode] = await db
      .select()
      .from(schema.transcodes)
      .where(eq(schema.transcodes.id, id))
      .limit(1);

    if (!transcode) {
      throw new Error(`Transcode with ID ${id} not found`);
    }

    const action = await createAction({
      transcodeId: transcode.id,
      action: body.action,
      payload: body.payload,
      payloadFromActionId: body.payloadFromActionId ?? null,
      maxAttempts: body.retry?.maxAttempts ?? 3,
      delay: body.retry?.delay ?? 1000,
    });

    return { id: action };
  },
  {
    tokenAuth: true,
    params: z.object({
      id: z.string(),
    }),
    body: z.object({
      action: z.string(),
      payload: z.any().optional().nullable(),
      payloadFromActionId: z.number().optional().nullable(),
      retry: z.object({
        maxAttempts: z.number(),
        delay: z.number(),
      }),
    }),
    response: z.object({
      id: z.number(),
    }),
  },
);

transcodeApp.get(
  "/transcode/:id/actions/pending",
  async ({ params }) => {
    const { id: paramId } = params;
    const id = Number(paramId);

    const actions = await db
      .select({ id: schema.transcodeActions.id })
      .from(schema.transcodeActions)
      .where(
        and(
          eq(schema.transcodeActions.transcodeId, id),
          notInArray(schema.transcodeActions.status, ["COMPLETED", "FAILED"]),
        ),
      );

    return actions.map((action) => action.id);
  },
  {
    tokenAuth: true,
    params: z.object({
      id: z.string(),
    }),
    response: z.array(z.number()),
  },
);

transcodeApp.get(
  "/transcode/:id/actions/:actionId",
  async ({ params }) => {
    const { id: paramId, actionId: paramActionId } = params;
    const id = Number(paramId);
    const actionId = Number(paramActionId);

    const [action] = await db
      .select({
        id: schema.transcodeActions.id,
        action: schema.transcodeActions.action,
        status: schema.transcodeActions.status,
        payload: schema.transcodeActions.payload,
        payloadFromActionId: schema.transcodeActions.payloadFromActionId,
        externalId: schema.transcodeActions.externalId,
        createdAt: schema.transcodeActions.createdAt,
        updatedAt: schema.transcodeActions.updatedAt,
      })
      .from(schema.transcodeActions)
      .where(
        and(
          eq(schema.transcodeActions.id, actionId),
          eq(schema.transcodeActions.transcodeId, id),
        ),
      )
      .limit(1);

    if (!action) {
      throw new Error(`Action with ID ${actionId} not found`);
    }

    const outputs = await db
      .select({
        output: schema.transcodeActionOutputs.output,
        id: schema.transcodeActionOutputs.id,
      })
      .from(schema.transcodeActionOutputs)
      .where(eq(schema.transcodeActionOutputs.transcodeActionId, actionId));

    const parsedOutputs = outputs.map((output) => ({
      output: JSON.parse(output.output),
      id: output.id,
    }));

    return {
      id: action.id,
      action: action.action,
      status: action.status,
      payload: action.payload ? JSON.parse(action.payload) : null,
      outputs: parsedOutputs,
      payloadFromActionId: action.payloadFromActionId,
      externalId: action.externalId,
      createdAt: parseDbDate("createdAt", action.createdAt),
      updatedAt: parseDbDate("updatedAt", action.updatedAt),
    };
  },
  {
    tokenAuth: true,
    params: z.object({
      id: z.string(),
      actionId: z.string(),
    }),
    response: z.object({
      id: z.number(),
      action: z.string(),
      status: z.string(),
      payload: z.any(),
      outputs: z.array(z.any()),
      payloadFromActionId: z.number().optional().nullable(),
      externalId: z.string().optional().nullable(),
      createdAt: z.number(),
      updatedAt: z.number(),
    }),
  },
);

export { transcodeApp };
