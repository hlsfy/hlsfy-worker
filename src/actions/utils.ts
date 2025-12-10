import { and, eq, notInArray } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import * as api from "./api";

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

  const externalActionId = await api.createAction({
    externalTranscodeId: transcode.externalId,
    action,
    payload,
    payloadFromActionId,
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

export const onData = async (
  actionId: number,
  {
    callback,
  }: {
    callback: (data: any) => Promise<void>;
  },
) => {
  let isNotCompleted = true;
  let lastOutputs: number[] = [];

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
        and(
          eq(schema.transcodeActionOutputs.transcodeActionId, action.id),
          notInArray(schema.transcodeActionOutputs.id, lastOutputs),
        ),
      );

    for (const output of outputs) {
      await callback(JSON.parse(output.output));
    }

    lastOutputs = [...lastOutputs, ...outputs.map((output) => output.id)];

    if (["COMPLETED", "FAILED"].includes(action.status)) {
      isNotCompleted = false;
    }
  }
};
