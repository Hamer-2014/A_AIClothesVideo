import { spawn } from "node:child_process";

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
    "-frames:v",
    String(normalizedFrameCount),
    pattern,
  ]);

  return Array.from(
    { length: normalizedFrameCount },
    (_, index) => `${frameDirectory}/frame-${index}.jpg`,
  );
}
