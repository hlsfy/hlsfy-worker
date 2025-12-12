import ffmpeg from "fluent-ffmpeg";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import { promisify } from "node:util";

import { HOME } from "./constants";

const gunzip = promisify(zlib.gunzip);

const REPO = "eugeneware/ffmpeg-static";
const RELEASE_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

type Tool = "ffmpeg" | "ffprobe";
type ReleaseAsset = { name: string; browser_download_url: string };

let releaseCache: any | null = null;

async function getLatestRelease(): Promise<any> {
  if (releaseCache) return releaseCache;

  const res = await fetch(RELEASE_URL, {
    headers: {
      "User-Agent": "hlsfy-worker",
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${REPO} latest release metadata (HTTP ${res.status})`
    );
  }

  releaseCache = await res.json();
  return releaseCache;
}

function mapArch(arch: string): string {
  if (arch === "x64" || arch === "arm64" || arch === "ia32" || arch === "arm")
    return arch;

  if (arch === "x86_64") return "x64";

  throw new Error(`Unsupported CPU arch: ${arch}`);
}

function findOnPath(cmd: string): string | null {
  const locator = process.platform === "win32" ? "where" : "which";

  try {
    const out = spawnSync(locator, [cmd], { encoding: "utf8" });
    if (out.status === 0 && out.stdout) {
      const first = out.stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find(Boolean);
      if (first) return first;
    }
  } catch {
    // ignore
  }

  const run = spawnSync(cmd, ["-version"], { stdio: "ignore" });
  if (run.status === 0) return cmd;

  return null;
}

async function downloadToFile(url: string, filePath: string) {
  const res = await fetch(url, { headers: { "User-Agent": "hlsfy-worker" } });
  if (!res.ok)
    throw new Error(`Download failed (HTTP ${res.status}) for ${url}`);

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const body: any = res.body;
  const canStream = body && typeof (Readable as any).fromWeb === "function";

  if (canStream) {
    const nodeStream = (Readable as any).fromWeb(body);
    await pipeline(nodeStream, createWriteStream(filePath));
  } else {
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(filePath, buf);
  }
}

async function withInstallLock(lockPath: string, fn: () => Promise<void>) {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  while (true) {
    try {
      const fh = await fs.open(lockPath, "wx");
      try {
        await fn();
      } finally {
        await fh.close().catch(() => {});
        await fs.unlink(lockPath).catch(() => {});
      }
      return;
    } catch (e: any) {
      if (e?.code !== "EEXIST") throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

async function installTool(tool: Tool): Promise<string> {
  const platform = process.platform;
  const arch = mapArch(process.arch);
  const exe = platform === "win32" ? ".exe" : "";

  const dir = path.join(HOME, "ffmpeg", `${platform}-${arch}`);
  const dest = path.join(dir, `${tool}${exe}`);

  if (existsSync(dest)) return dest;

  const lock = path.join(dir, ".install.lock");

  await withInstallLock(lock, async () => {
    if (existsSync(dest)) return;

    const release = await getLatestRelease();
    const assets: ReleaseAsset[] = release.assets ?? [];

    const prefix = `${tool}-${platform}-${arch}`;

    const picked =
      assets.find((a) => a.name === prefix || a.name === `${prefix}${exe}`) ??
      assets.find(
        (a) => a.name === `${prefix}.gz` || a.name === `${prefix}${exe}.gz`
      );

    if (!picked) {
      const sample = assets
        .map((a) => a.name)
        .filter((n) => n.startsWith(`${tool}-`))
        .slice(0, 80)
        .join(", ");
      throw new Error(
        `No ${tool} binary found for ${platform}-${arch} in ${REPO} latest release. ` +
          `Available (sample): ${sample}`
      );
    }

    await fs.mkdir(dir, { recursive: true });

    const tmp = dest + ".tmp";

    if (picked.name.endsWith(".gz")) {
      const res = await fetch(picked.browser_download_url, {
        headers: { "User-Agent": "hlsfy-worker" },
      });
      if (!res.ok)
        throw new Error(
          `Download failed (HTTP ${res.status}) for ${picked.browser_download_url}`
        );

      const gz = Buffer.from(await res.arrayBuffer());
      const raw = await gunzip(gz);
      await fs.writeFile(tmp, raw);
    } else {
      await downloadToFile(picked.browser_download_url, tmp);
    }

    if (platform !== "win32") {
      await fs.chmod(tmp, 0o755);
    }

    await fs.rename(tmp, dest);

    const test = spawnSync(dest, ["-version"], { stdio: "ignore" });
    if (test.status !== 0) {
      throw new Error(`${tool} downloaded but failed to run: ${dest}`);
    }
  });

  return dest;
}

async function resolveTools(): Promise<{
  ffmpegPath: string;
  ffprobePath: string;
}> {
  const ffmpegCmd = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const ffprobeCmd = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";

  const ffmpegPath = findOnPath(ffmpegCmd) ?? (await installTool("ffmpeg"));
  const ffprobePath = findOnPath(ffprobeCmd) ?? (await installTool("ffprobe"));

  return { ffmpegPath, ffprobePath };
}

let initPromise: Promise<typeof ffmpeg> | null = null;

export const getFFmpeg = () => {
  if (!initPromise) {
    initPromise = (async () => {
      const { ffmpegPath, ffprobePath } = await resolveTools();

      ffmpeg.setFfmpegPath(ffmpegPath);
      ffmpeg.setFfprobePath(ffprobePath);

      return ffmpeg;
    })();
  }

  return initPromise;
};
