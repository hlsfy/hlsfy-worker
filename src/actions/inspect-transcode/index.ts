import { ActionResult } from "..";
import { getAction, getSession, onData } from "../utils";

export const inspectTranscode = async (actionId: number): ActionResult => {
  const action = await getAction(actionId);

  if (!action.payload && !action.payloadFromActionId) {
    const session = await getSession(action.transcodeId);

    if (!session) {
      return { status: "FAILED", retry: false };
    }

    await execute(action, session.sourceFilePath);
  }

  if (action.payload) {
    await execute(action, action.payload.path);
  }

  if (action.payloadFromActionId) {
    onData(actionId, {
      callback: async (data) => {
        await execute(action, data.path);
      },
    });
  }
};

async function execute(
  action: Awaited<ReturnType<typeof getAction>>,
  filePath: string,
) {}
