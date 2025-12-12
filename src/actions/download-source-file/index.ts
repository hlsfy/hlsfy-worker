import { eq } from "drizzle-orm";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { createActionOutput, getAction } from "../utils";
import os from "os";
import fs from "fs";
import path from "path";
import axios from "axios";
import * as fileType from "file-type";
import { getStorageClient } from "../../storage-clients/utils";

export const downloadSourceFile = async (actionId: number) => {
  const action = await getAction(actionId);

  const [transcode] = await db
    .select()
    .from(schema.transcodes)
    .where(eq(schema.transcodes.id, action.transcodeId));

  if (!transcode) {
    throw new Error("Transcode not found");
  }

  const homeFolder = fs.mkdtempSync(path.join(os.tmpdir(), "hlsfy"));
  const rawSourceFilePath = path.join(homeFolder, "source");

  if (transcode.inputFileSource === "URL") {
    console.log(`Downloading file from URL: ${transcode.inputFileUrl}`);
    if (!transcode.inputFileUrl) {
      throw new Error("Input file URL not found");
    }

    const { data: fileStream } = await axios.get(transcode.inputFileUrl, {
      responseType: "stream",
    });

    const file = fs.createWriteStream(rawSourceFilePath);
    fileStream.pipe(file);

    await new Promise<void>((resolve, reject) => {
      file.on("finish", resolve);
      file.on("error", reject);
    });
  } else if (transcode.inputFileSource === "STORAGE") {
    if (!transcode.inputStorage || !transcode.inputFileKey) {
      throw new Error("Input storage or input file key not found");
    }

    console.log(`Downloading file from storage: ${transcode.inputFileKey}`);

    const storageClient = getStorageClient(transcode.inputStorage);

    await storageClient.downloadFile({
      key: transcode.inputFileKey,
      outputPath: rawSourceFilePath,
    });
  } else {
    throw new Error("Unsupported input file source");
  }

  if (!fs.existsSync(rawSourceFilePath)) {
    throw new Error("Source file not found");
  }

  const sourceType = await getFileType(rawSourceFilePath);
  const sourceFilePath = `${rawSourceFilePath}.${sourceType.ext}`;

  fs.renameSync(rawSourceFilePath, sourceFilePath);

  await createActionOutput({
    actionId,
    transcodeId: action.transcodeId,
    output: {
      path: sourceFilePath,
      homeFolder,
    },
  });
};

async function getFileType(filePath: string) {
  const result = await fileType.fileTypeFromFile(filePath);

  if (!result) {
    throw new Error("file type not found");
  }

  return result;
}
