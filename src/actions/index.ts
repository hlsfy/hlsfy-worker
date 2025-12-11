import z from "zod";
import { downloadSourceFile } from "./download-source-file";
import { inspectTranscode } from "./inspect-transcode";

export type ActionResult = Promise<{
  status: "COMPLETED" | "FAILED";
  retry: boolean;
} | void>;

export const ACTIONS: {
  name: string;
  isInputFile: boolean;
  isOutputFile: boolean;
  handler: (actionId: number) => ActionResult;
  payloadSchema?: any;
}[] = [
  {
    name: "DOWNLOAD_SOURCE_FILE",
    isInputFile: false,
    isOutputFile: true,
    handler: downloadSourceFile,
  },
  {
    name: "INSPECT_TRANSCODE",
    isInputFile: true,
    isOutputFile: false,
    handler: inspectTranscode,
    payloadSchema: z
      .object({
        path: z.string(),
      })
      .optional(),
  },
];
