import { describe, expect, it } from "vitest";

import { buildConcatList, extractQaFrames, stitchSegments } from "./ffmpeg";

describe("ffmpeg helpers", () => {
  it("builds an ffmpeg concat list with escaped file paths", () => {
    expect(buildConcatList(["C:\\tmp\\a one.mp4", "/tmp/b'two.mp4"])).toBe(
      "file 'C:\\tmp\\a one.mp4'\nfile '/tmp/b'\\''two.mp4'\n",
    );
  });

  it("runs ffmpeg concat with faststart output", async () => {
    const commands: Array<{ command: string; args: string[] }> = [];

    await stitchSegments({
      concatListPath: "/tmp/input.txt",
      outputPath: "/tmp/final.mp4",
      runCommand: async (command, args) => {
        commands.push({ command, args });
      },
    });

    expect(commands).toEqual([
      {
        command: "ffmpeg",
        args: [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "/tmp/input.txt",
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          "/tmp/final.mp4",
        ],
      },
    ]);
  });

  it("extracts QA frames from the stitched video", async () => {
    const commands: Array<{ command: string; args: string[] }> = [];

    const frames = await extractQaFrames({
      videoPath: "/tmp/final.mp4",
      frameDirectory: "/tmp/frames",
      frameCount: 3,
      runCommand: async (command, args) => {
        commands.push({ command, args });
      },
    });

    expect(frames).toEqual([
      "/tmp/frames/frame-0.jpg",
      "/tmp/frames/frame-1.jpg",
      "/tmp/frames/frame-2.jpg",
    ]);
    expect(commands[0]?.args).toContain("fps=1/3");
  });
});
