import { promise as fastq } from "fastq";
import { db } from "./db";
import * as schema from "./db/schema";
import { eq, InferSelectModel } from "drizzle-orm";
import { updateActionStatus } from "./actions/utils";
import { ACTIONS } from "./actions";

const defaultConcurrency = Number(process.env.QUEUE_CONCURRENCY || 3);

async function worker(actionId: number) {
  let [dbAction] = await db
    .select()
    .from(schema.transcodeActions)
    .where(eq(schema.transcodeActions.id, actionId));

  if (!dbAction) {
    throw new Error("Action not found");
  }

  const action = ACTIONS.find((action) => action.name === dbAction.action);

  if (!action) {
    throw new Error("Action not found");
  }

  [dbAction] = await db
    .update(schema.transcodeActions)
    .set({
      status: "RUNNING",
      currentAttempt: dbAction.currentAttempt + 1,
    })
    .where(eq(schema.transcodeActions.id, actionId))
    .returning();

  try {
    console.log(`[${dbAction.action}] starting the execution`);
    const result = await action.handler(dbAction.id);

    if (result && result.status === "FAILED" && result.retry) {
      throw new Error("unkown error");
    }

    await updateActionStatus({
      actionId: dbAction.id,
      status: result?.status || "COMPLETED",
      transcodeId: dbAction.transcodeId as number,
    });

    console.log(`[${dbAction.action}] finished`);
  } catch (e: any) {
    const currentAttempt = dbAction.currentAttempt;

    if (currentAttempt < dbAction.maxAttempts) {
      console.error(`[${dbAction.action}] Error occurred:\n`, e);
      console.log(
        `[${dbAction.action}] Waiting ${dbAction.delay} ms for retry`,
      );

      setTimeout(async () => {
        try {
          await db
            .update(schema.transcodeActions)
            .set({ status: "PENDING" })
            .where(eq(schema.transcodeActions.id, actionId));

          console.log(
            `[${dbAction.action}] backing to queue for retry #${currentAttempt + 1} | max attempts: ${dbAction.maxAttempts}`,
          );

          await queue.push(actionId);
        } catch (err) {
          finishError(dbAction, e);
        }
      }, dbAction.delay);
    } else {
      finishError(dbAction, e);
    }
  }
}

async function finishError(
  dbAction: InferSelectModel<typeof schema.transcodeActions>,
  e: any,
) {
  await updateActionStatus({
    actionId: dbAction.id,
    status: "FAILED",
    transcodeId: dbAction.transcodeId as number,
  });

  console.error(`[${dbAction.action}] Error occurred:\n`, e);
  console.error(`[${dbAction.action}] not retrying anymore`);
}

const queue = fastq<number>(worker, defaultConcurrency);

export { queue };
