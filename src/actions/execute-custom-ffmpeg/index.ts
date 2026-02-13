import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { ActionResult } from "..";
import { getFFmpeg, resolveFfmpegTools } from "../../ffmpeg";
import {
  createActionOutput,
  getAction,
  getSession,
  waitAction,
} from "../utils";

type ExecuteCustomFfmpegPayload = {
  command: string;
  inputs?: string[];
  outputFilenames: string[];
};

export const executeCustomFfmpeg = async (actionId: number): ActionResult => {
  const action = await getAction(actionId);

  if (!action.payload && !action.payloadFromActionId) {
    return { status: "FAILED", retry: false };
  }

  const payload = action.payload as Partial<ExecuteCustomFfmpegPayload> | null;
  const payloadFromData = await getPayloadFromActionData(
    action.payloadFromActionId,
  );
  const command = normalizeCommand(payload?.command) || payloadFromData.command;
  const outputFilenames =
    normalizeOutputFilenames(payload?.outputFilenames) ||
    payloadFromData.outputFilenames;

  const session = await getSession(action.transcodeId);

  if (!session) {
    return { status: "FAILED", retry: false };
  }

  if (action.payloadFromActionId && !payloadFromData.inputPaths.length) {
    return { status: "FAILED", retry: false };
  }

  if (!command || !outputFilenames?.length) {
    return { status: "FAILED", retry: false };
  }

  const payloadInputs = Array.isArray(payload?.inputs)
    ? payload.inputs.filter(
        (inputPath): inputPath is string =>
          typeof inputPath === "string" && Boolean(inputPath.trim()),
      )
    : [];
  const inputPaths = [...payloadInputs, ...payloadFromData.inputPaths];

  if (!inputPaths.length) {
    return { status: "FAILED", retry: false };
  }

  for (const inputPath of inputPaths) {
    await fs.access(inputPath);
  }

  const outputPaths = await resolveOutputPaths({
    actionId: action.id,
    homeFolder: session.homeFolder,
    outputFilenames,
  });

  const commandArgs = splitCommandArgs(command);
  const ffmpegArgs = [
    ...inputPaths.flatMap((inputPath) => ["-i", inputPath]),
    ...commandArgs,
    ...outputPaths,
  ];

  const { ffmpegPath } = await resolveFfmpegTools();

  await runCommand(ffmpegPath, ffmpegArgs);

  for (const outputPath of outputPaths) {
    await fs.access(outputPath);

    await createActionOutput({
      actionId: action.id,
      transcodeId: action.transcodeId,
      output: {
        path: outputPath,
        homeFolder: session.homeFolder,
      },
    });
  }
};

async function getPayloadFromActionData(payloadFromActionId: number | null) {
  if (!payloadFromActionId) {
    return {
      inputPaths: [],
      command: null as string | null,
      outputFilenames: null as string[] | null,
    };
  }

  const outputs = await waitAction<any>(payloadFromActionId);
  const inputPaths = outputs.flatMap((output) => extractOutputPaths(output));
  let command: string | null = null;
  let outputFilenames: string[] | null = null;

  for (const output of outputs) {
    if (!command) {
      command = normalizeCommand(output?.command);
    }

    if (!outputFilenames) {
      outputFilenames = normalizeOutputFilenames(output?.outputFilenames);
    }
  }

  return {
    inputPaths,
    command,
    outputFilenames,
  };
}

function extractOutputPaths(output: any) {
  const paths: string[] = [];

  if (typeof output?.path === "string" && output.path.trim()) {
    paths.push(output.path);
  }

  if (Array.isArray(output?.paths)) {
    for (const pathValue of output.paths) {
      if (typeof pathValue === "string" && pathValue.trim()) {
        paths.push(pathValue);
      }
    }
  }

  return paths;
}

function normalizeCommand(command: unknown) {
  if (typeof command !== "string") return null;
  const trimmed = command.trim();
  return trimmed ? trimmed : null;
}

function normalizeOutputFilenames(outputFilenames: unknown) {
  if (!Array.isArray(outputFilenames)) return null;

  const normalizedOutputFilenames = outputFilenames.filter(
    (outputFilename): outputFilename is string =>
      typeof outputFilename === "string" && Boolean(outputFilename.trim()),
  );

  if (!normalizedOutputFilenames.length) return null;

  return normalizedOutputFilenames;
}

async function resolveOutputPaths({
  actionId,
  homeFolder,
  outputFilenames,
}: {
  actionId: number;
  homeFolder: string;
  outputFilenames: string[];
}) {
  const outputHomeFolder = path.resolve(
    path.join(homeFolder, `custom-ffmpeg-${actionId}`),
  );

  await fs.mkdir(outputHomeFolder, { recursive: true });

  const outputPaths: string[] = [];

  for (const outputFilename of outputFilenames) {
    const safeFilename = getSafeRelativeOutputName(outputFilename);
    const outputPath = path.resolve(path.join(outputHomeFolder, safeFilename));

    if (!isPathInside(outputPath, outputHomeFolder)) {
      throw new Error("Output filename points outside of session home folder");
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

function getSafeRelativeOutputName(outputFilename: string) {
  if (path.isAbsolute(outputFilename)) {
    throw new Error("Output filename must be relative");
  }

  const normalizedName = path.normalize(outputFilename);

  if (!normalizedName || normalizedName === "." || normalizedName === "..") {
    throw new Error("Invalid output filename");
  }

  if (normalizedName.startsWith(`..${path.sep}`)) {
    throw new Error("Output filename cannot escape the output folder");
  }

  return normalizedName;
}

function isPathInside(targetPath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, targetPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function splitCommandArgs(command: string) {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error("Invalid command: missing closing quote");
  }

  if (escaped) {
    current += "\\";
  }

  if (current) {
    args.push(current);
  }

  return args;
}

function runCommand(commandPath: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn(commandPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const ffmpegError = stderr.slice(-3000).trim();
      reject(
        new Error(
          `ffmpeg command failed with code ${code}. ${ffmpegError || ""}`.trim(),
        ),
      );
    });
  });
}
