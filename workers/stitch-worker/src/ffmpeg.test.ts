import { describe, expect, it } from "vitest";

import {
  buildConcatList,
  extractCoverFrame,
  extractQaFrames,
  listExtractedQaFrames,
  stitchSegments,
} from "./ffmpeg.js";

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
      framePlan: [
        {
          timestampSeconds: 1.6,
          kind: "segment",
          segmentIndex: 0,
          frameIndex: 0,
        },
        {
          timestampSeconds: 8,
          kind: "transition",
          segmentIndex: 0,
          frameIndex: 0,
        },
      ],
      runCommand: async (command, args) => {
        commands.push({ command, args });
      },
    });

    expect(frames).toEqual([
      "/tmp/frames/segment-0-frame-0.jpg",
      "/tmp/frames/transition-0-1.jpg",
    ]);
    expect(commands).toHaveLength(2);
    expect(commands[0]?.args).toEqual(
      expect.arrayContaining(["-ss", "1.6", "-frames:v", "1"]),
    );
  });

  it("extracts a webp cover frame at the default timestamp", async () => {
    const commands: Array<{ command: string; args: string[] }> = [];

    await extractCoverFrame({
      videoPath: "/tmp/final.mp4",
      coverPath: "/tmp/cover.webp",
      runCommand: async (command, args) => {
        commands.push({ command, args });
      },
    });

    expect(commands).toEqual([
      {
        command: "ffmpeg",
        args: [
          "-y",
          "-ss",
          "00:00:04",
          "-i",
          "/tmp/final.mp4",
          "-frames:v",
          "1",
          "-vf",
          "scale=720:-1",
          "/tmp/cover.webp",
        ],
      },
    ]);
  });

  it("lists actual extracted frames instead of assuming numbering starts at zero", async () => {
    const frames = await listExtractedQaFrames({
      frameDirectory: "/tmp/frames",
      frameCount: 3,
      readDirectory: async () => ["frame-1.jpg", "frame-2.jpg", "frame-3.jpg"],
    });

    expect(frames).toEqual([
      "/tmp/frames/frame-1.jpg",
      "/tmp/frames/frame-2.jpg",
      "/tmp/frames/frame-3.jpg",
    ]);
  });
});
