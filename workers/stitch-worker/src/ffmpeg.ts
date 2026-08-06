import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";

import type { QaFramePoint } from "./qa-frame-plan.js";

export type RunCommand = (command: string, args: string[]) => Promise<void>;
export type CaptureCommand = (
  command: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

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

export const defaultCaptureCommand: CaptureCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}.`));
    });
  });

export function parseFreezeDurations(output: string) {
  return Array.from(output.matchAll(/freeze_duration:\s*([0-9]+(?:\.[0-9]+)?)/g))
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
}

function parseVideoDimensions(output: string) {
  try {
    const parsed = JSON.parse(output) as {
      streams?: Array<{ width?: unknown; height?: unknown }>;
    };
    const width = Number(parsed.streams?.[0]?.width);
    const height = Number(parsed.streams?.[0]?.height);
    if (Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0) {
      return { width, height };
    }
  } catch {
    // Use the stable probe error below.
  }

  throw new Error("video_quality_probe_failed");
}

const aspectRatioValues = {
  "9:16": 9 / 16,
  "1:1": 1,
  "16:9": 16 / 9,
} as const;

export async function inspectVideoTechnicalQuality({
  videoPath,
  expectedAspectRatio,
  minimumShortSide,
  detectFreeze,
  runCommand = defaultCaptureCommand,
}: {
  videoPath: string;
  expectedAspectRatio: keyof typeof aspectRatioValues | null;
  minimumShortSide: number | null;
  detectFreeze: boolean;
  runCommand?: CaptureCommand;
}) {
  const probe = await runCommand("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    videoPath,
  ]);
  const dimensions = parseVideoDimensions(probe.stdout);

  if (expectedAspectRatio) {
    const expected = aspectRatioValues[expectedAspectRatio];
    const actual = dimensions.width / dimensions.height;
    if (Math.abs(actual - expected) / expected > 0.03) {
      throw new Error("video_quality_aspect_ratio_mismatch");
    }
  }

  if (minimumShortSide && Math.min(dimensions.width, dimensions.height) < minimumShortSide) {
    throw new Error("video_quality_resolution_below_minimum");
  }

  if (detectFreeze) {
    const freezeResult = await runCommand("ffmpeg", [
      "-v",
      "info",
      "-i",
      videoPath,
      "-vf",
      "freezedetect=n=-50dB:d=1.0",
      "-an",
      "-f",
      "null",
      "-",
    ]);
    if (parseFreezeDurations(`${freezeResult.stdout}\n${freezeResult.stderr}`)
      .some((duration) => duration >= 1)) {
      throw new Error("video_quality_freeze_detected");
    }
  }

  return dimensions;
}

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
  framePlan,
  runCommand = defaultRunCommand,
}: {
  videoPath: string;
  frameDirectory: string;
  framePlan: QaFramePoint[];
  runCommand?: RunCommand;
}) {
  const outputPaths: string[] = [];

  for (const point of framePlan) {
    const fileName =
      point.kind === "transition"
        ? `transition-${point.segmentIndex}-${point.segmentIndex + 1}.jpg`
        : `segment-${point.segmentIndex}-frame-${point.frameIndex}.jpg`;
    const outputPath = `${frameDirectory}/${fileName}`;
    await runCommand("ffmpeg", [
      "-y",
      "-ss",
      String(point.timestampSeconds),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      outputPath,
    ]);
    outputPaths.push(outputPath);
  }

  return outputPaths;
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
