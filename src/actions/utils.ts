import { and, eq, notInArray } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import * as api from "./api";
import { queue } from "../queue";
import { ACTIONS } from ".";

export const createAction = async ({
  transcodeId,
  action,
  payload,
  payloadFromActionId,
  maxAttempts,
  delay,
}: {
  transcodeId: number;
  action: string;
  payload: any;
  payloadFromActionId: number | null;
  maxAttempts: number;
  delay: number;
}) => {
  const [transcode] = await db
    .select()
    .from(schema.transcodes)
    .where(eq(schema.transcodes.id, transcodeId))
    .limit(1);

  if (!transcode) {
    throw new Error(`Transcode with ID ${transcodeId} not found`);
  }

  const actionItem = ACTIONS.find((a) => a.name === action);

  if (!actionItem) {
    throw new Error("Action not found");
  }

  if (payload && Object.keys(payload).length && actionItem.payloadSchema) {
    const payloadResult = actionItem.payloadSchema.safeParse(payload);

    if (!payloadResult.success) {
      throw new Error("Invalid payload");
    }

    payload = payloadResult.data;
  }

  let payloadFromExternalActionId: string | null = null;

  if (payloadFromActionId) {
    const [payloadAction] = await db
      .select()
      .from(schema.transcodeActions)
      .where(eq(schema.transcodeActions.id, payloadFromActionId))
      .limit(1);

    if (!payloadAction) {
      throw new Error("Payload action not found");
    }

    payloadFromExternalActionId = payloadAction.externalId;

    if (actionItem.isInputFile) {
      const payloadActionItem = ACTIONS.find(
        (a) => a.name === payloadAction.action
      );

      if (!payloadActionItem) {
        throw new Error("Payload action not found");
      }

      if (!payloadActionItem.isOutputFile) {
        throw new Error("Payload action is not output file");
      }
    }
  }

  const externalActionId = await api.createAction({
    externalTranscodeId: transcode.externalId,
    action,
    payload,
    payloadFromActionId: payloadFromExternalActionId,
  });

  const [createdAction] = await db
    .insert(schema.transcodeActions)
    .values({
      externalId: externalActionId,
      transcodeId: transcode.id,
      action,
      payload: JSON.stringify(payload),
      payloadFromActionId,
      status: "PENDING",
      maxAttempts,
      delay,
    })
    .returning();

  queue.push(createdAction.id);

  return createdAction.id;
};

export const updateActionStatus = async ({
  transcodeId,
  actionId,
  status,
}: {
  transcodeId: number;
  actionId: number;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
}) => {
  const [transcode] = await db
    .select()
    .from(schema.transcodes)
    .where(eq(schema.transcodes.id, transcodeId))
    .limit(1);

  if (!transcode) {
    throw new Error(`Transcode with ID ${transcodeId} not found`);
  }

  const [action] = await db
    .select()
    .from(schema.transcodeActions)
    .where(eq(schema.transcodeActions.id, actionId))
    .limit(1);

  if (!action) {
    throw new Error(`Action with ID ${actionId} not found`);
  }

  await api.updateActionStatus({
    externalTranscodeId: transcode.externalId,
    externalActionId: action.externalId,
    status,
  });

  await db
    .update(schema.transcodeActions)
    .set({ status })
    .where(eq(schema.transcodeActions.id, action.id));
};

export const createActionOutput = async ({
  transcodeId,
  actionId,
  output,
}: {
  transcodeId: number;
  actionId: number;
  output: any;
}) => {
  const [transcode] = await db
    .select()
    .from(schema.transcodes)
    .where(eq(schema.transcodes.id, transcodeId))
    .limit(1);

  if (!transcode) {
    throw new Error(`Transcode with ID ${transcodeId} not found`);
  }

  const [action] = await db
    .select()
    .from(schema.transcodeActions)
    .where(eq(schema.transcodeActions.id, actionId))
    .limit(1);

  if (!action) {
    throw new Error(`Action with ID ${actionId} not found`);
  }

  const externalActionOutputId = await api.createActionOutput({
    externalTranscodeId: transcode.externalId,
    externalActionId: action.externalId,
    output,
  });

  await db.insert(schema.transcodeActionOutputs).values({
    externalId: externalActionOutputId,
    transcodeActionId: action.id,
    output: JSON.stringify(output),
  });
};

export async function waitAction<T>(actionId: number): Promise<T[]> {
  let isNotCompleted = true;

  let allOutputs: T[] = [];

  while (isNotCompleted) {
    const [action] = await db
      .select()
      .from(schema.transcodeActions)
      .where(eq(schema.transcodeActions.id, actionId))
      .limit(1);

    if (!action) {
      throw new Error(`Action with ID ${actionId} not found`);
    }

    const outputs = await db
      .select()
      .from(schema.transcodeActionOutputs)
      .where(
        and(eq(schema.transcodeActionOutputs.transcodeActionId, action.id))
      );

    if (["COMPLETED", "FAILED"].includes(action.status)) {
      allOutputs = outputs.map((output) => JSON.parse(output.output));
      isNotCompleted = false;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return allOutputs;
}

export const onData = async (
  actionId: number,
  callback: (data: any) => Promise<void>
) => {
  let lastOutputs: number[] = [];

  while (true) {
    const [action] = await db
      .select({
        id: schema.transcodeActions.id,
        status: schema.transcodeActions.status,
      })
      .from(schema.transcodeActions)
      .where(eq(schema.transcodeActions.id, actionId))
      .limit(1);

    if (!action) {
      throw new Error(`Action with ID ${actionId} not found`);
    }

    const outputs = await db
      .select()
      .from(schema.transcodeActionOutputs)
      .where(
        and(
          eq(schema.transcodeActionOutputs.transcodeActionId, action.id),
          notInArray(schema.transcodeActionOutputs.id, lastOutputs)
        )
      );

    for (const output of outputs) {
      await callback(JSON.parse(output.output));
    }

    lastOutputs = [...lastOutputs, ...outputs.map((output) => output.id)];

    if (["COMPLETED", "FAILED"].includes(action.status)) {
      break;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

export async function getAction(actionId: number) {
  const [action] = await db
    .select()
    .from(schema.transcodeActions)
    .where(eq(schema.transcodeActions.id, actionId))
    .limit(1);

  if (!action) {
    throw new Error(`Action with ID ${actionId} not found`);
  }

  return {
    ...action,
    payload: action.payload ? JSON.parse(action.payload) : null,
  };
}

export const getSession = async (transcodeId: number) => {
  let [activedSession] = await db
    .select({
      homeFolder: schema.transcodeSessions.homeFolder,
      sourceFilePath: schema.transcodeSessions.sourceFilePath,
    })
    .from(schema.transcodeSessions)
    .where(
      and(
        eq(schema.transcodeSessions.transcodeId, transcodeId),
        eq(schema.transcodeSessions.status, "ACTIVE")
      )
    );

  if (!activedSession) {
    const actionId = await createAction({
      action: "DOWNLOAD_SOURCE_FILE",
      delay: 1000,
      maxAttempts: 3,
      transcodeId,
      payload: {},
      payloadFromActionId: null,
    });

    const [output] = await waitAction<{ homeFolder: string; path: string }>(
      actionId
    );

    if (!output) return null;

    let [createdSession] = await db
      .insert(schema.transcodeSessions)
      .values({
        transcodeId,
        status: "ACTIVE",
        sourceFilePath: output.path,
        homeFolder: output.homeFolder,
      })
      .returning({
        homeFolder: schema.transcodeSessions.homeFolder,
        sourceFilePath: schema.transcodeSessions.sourceFilePath,
      });

    activedSession = createdSession;
  }

  return activedSession;
};
