import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";

export type RunCommand = (command: string, args: string[]) => Promise<void>;

export const defaultRunCommand: RunCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}.`));
    });
  });

function quoteConcatPath(path: string) {
  return `'${path.replaceAll("'", "'\\''")}'`;
}

export function buildConcatList(segmentPaths: string[]) {
  return segmentPaths.map((path) => `file ${quoteConcatPath(path)}`).join("\n") + "\n";
}

export async function stitchSegments({
  concatListPath,
  outputPath,
  runCommand = defaultRunCommand,
}: {
  concatListPath: string;
  outputPath: string;
  runCommand?: RunCommand;
}) {
  await runCommand("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function extractCoverFrame({
  videoPath,
  coverPath,
  timestamp = "00:00:04",
  runCommand = defaultRunCommand,
}: {
  videoPath: string;
  coverPath: string;
  timestamp?: string;
  runCommand?: RunCommand;
}) {
  await runCommand("ffmpeg", [
    "-y",
    "-ss",
    timestamp,
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=720:-1",
    coverPath,
  ]);
}

export async function extractQaFrames({
  videoPath,
  frameDirectory,
  frameCount = 3,
  runCommand = defaultRunCommand,
}: {
  videoPath: string;
  frameDirectory: string;
  frameCount?: number;
  runCommand?: RunCommand;
}) {
  const normalizedFrameCount = Math.max(1, frameCount);
  const pattern = `${frameDirectory}/frame-%d.jpg`;

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    `fps=1/${normalizedFrameCount}`,
    "-start_number",
    "0",
    "-frames:v",
    String(normalizedFrameCount),
    pattern,
  ]);

  return Array.from(
    { length: normalizedFrameCount },
    (_, index) => `${frameDirectory}/frame-${index}.jpg`,
  );
}

export async function listExtractedQaFrames({
  frameDirectory,
  frameCount,
  readDirectory = readdir,
}: {
  frameDirectory: string;
  frameCount: number;
  readDirectory?: (path: string) => Promise<string[]>;
}) {
  const frameNames = (await readDirectory(frameDirectory))
    .filter((name) => /^frame-\d+\.jpg$/.test(name))
    .sort((a, b) => {
      const left = Number(a.match(/\d+/)?.[0] ?? 0);
      const right = Number(b.match(/\d+/)?.[0] ?? 0);
      return left - right;
    })
    .slice(0, frameCount);

  if (frameNames.length === 0) {
    throw new Error("No QA frames were extracted.");
  }

  return frameNames.map((name) => `${frameDirectory}/${name}`);
}
