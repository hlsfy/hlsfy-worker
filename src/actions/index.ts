import { inspectTranscode } from "./inspect-transcode";

export const ACTIONS: {
  name: string;
  isInputFile: boolean;
  isOutputFile: boolean;
  handler: (actionId: string) => Promise<void>;
}[] = [
  {
    name: "INSPECT_TRANSCODE",
    isInputFile: false,
    isOutputFile: false,
    handler: inspectTranscode,
  },
];
