import fs from "fs/promises";
import path from "path";
import { and, eq, inArray } from "drizzle-orm";
import { ActionResult } from "..";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { getAction } from "../utils";

export const expireTranscodeSessions = async (
  actionId: number,
): ActionResult => {
  const action = await getAction(actionId);

  const activeSessions = await db
    .select({
      id: schema.transcodeSessions.id,
      homeFolder: schema.transcodeSessions.homeFolder,
      sourceFilePath: schema.transcodeSessions.sourceFilePath,
    })
    .from(schema.transcodeSessions)
    .where(
      and(
        eq(schema.transcodeSessions.transcodeId, action.transcodeId),
        eq(schema.transcodeSessions.status, "ACTIVE"),
      ),
    );

  const activeSessionIds = activeSessions.map((session) => session.id);

  if (!activeSessionIds.length) return;

  const cleanupTargets = new Set<string>();

  for (const session of activeSessions) {
    cleanupTargets.add(session.homeFolder);
    cleanupTargets.add(session.sourceFilePath);
  }

  for (const targetPath of cleanupTargets) {
    const resolvedPath = path.resolve(targetPath);

    if (!isSafePath(resolvedPath)) {
      throw new Error(`Refusing to delete unsafe path: ${resolvedPath}`);
    }

    await fs.rm(resolvedPath, { recursive: true, force: true });
  }

  await db
    .update(schema.transcodeSessions)
    .set({ status: "EXPIRED" })
    .where(inArray(schema.transcodeSessions.id, activeSessionIds));
};

function isSafePath(targetPath: string) {
  const parsedPath = path.parse(targetPath);
  return parsedPath.root !== targetPath;
}
