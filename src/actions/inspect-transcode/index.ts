import { ActionResult } from "..";
import { getFFmpeg } from "../../ffmpeg";
import { createActionOutput, getAction, getSession, onData } from "../utils";
import ffmpeg from "fluent-ffmpeg";

export const inspectTranscode = async (actionId: number): ActionResult => {
  const action = await getAction(actionId);

  const promises = [];

  if (!action.payload && !action.payloadFromActionId) {
    const session = await getSession(action.transcodeId);

    if (!session) {
      return { status: "FAILED", retry: false };
    }

    promises.push(execute(action, session.sourceFilePath));
  }

  if (action.payload) {
    promises.push(execute(action, action.payload.path));
  }

  if (action.payloadFromActionId) {
    promises.push(
      onData(action.payloadFromActionId, async (data) => {
        await execute(action, data.path);
      })
    );
  }

  await Promise.all(promises);
};

async function execute(
  action: Awaited<ReturnType<typeof getAction>>,
  filePath: string
) {
  console.log(`Executing action ${action.action} with file ${filePath}`);

  const ffmpegExecutor = await getFFmpeg();

  const data = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpegExecutor.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });

  await createActionOutput({
    actionId: action.id,
    transcodeId: action.transcodeId,
    output: data,
  });
}
