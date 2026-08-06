import { describe, expect, it } from "vitest";

import {
  buildConcatList,
  extractCoverFrame,
  extractQaFrames,
  inspectVideoTechnicalQuality,
  listExtractedQaFrames,
  parseFreezeDurations,
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

  it("parses every completed freeze duration from ffmpeg diagnostics", () => {
    expect(parseFreezeDurations(`
[freezedetect @ 0x1] freeze_start: 8.073
[freezedetect @ 0x1] freeze_duration: 1.041
[freezedetect @ 0x1] freeze_end: 9.114
[freezedetect @ 0x1] freeze_duration: 0.250
    `)).toEqual([1.041, 0.25]);
  });

  it("accepts a 9:16 video that meets the minimum short side without a freeze", async () => {
    const commands: Array<{ command: string; args: string[] }> = [];

    await expect(inspectVideoTechnicalQuality({
      videoPath: "/tmp/final.mp4",
      expectedAspectRatio: "9:16",
      minimumShortSide: 720,
      detectFreeze: true,
      runCommand: async (command, args) => {
        commands.push({ command, args });
        return command === "ffprobe"
          ? { stdout: JSON.stringify({ streams: [{ width: 720, height: 1280 }] }), stderr: "" }
          : { stdout: "", stderr: "" };
      },
    })).resolves.toEqual({ width: 720, height: 1280 });

    expect(commands.map(({ command }) => command)).toEqual(["ffprobe", "ffmpeg"]);
    expect(commands[1]?.args).toContain("freezedetect=n=-50dB:d=1.0");
  });

  it("rejects a 2:3 video when the payload requires 9:16", async () => {
    await expect(inspectVideoTechnicalQuality({
      videoPath: "/tmp/final.mp4",
      expectedAspectRatio: "9:16",
      minimumShortSide: 720,
      detectFreeze: false,
      runCommand: async () => ({
        stdout: JSON.stringify({ streams: [{ width: 800, height: 1200 }] }),
        stderr: "",
      }),
    })).rejects.toThrow("video_quality_aspect_ratio_mismatch");
  });

  it("rejects a video below the requested minimum short side", async () => {
    await expect(inspectVideoTechnicalQuality({
      videoPath: "/tmp/final.mp4",
      expectedAspectRatio: "9:16",
      minimumShortSide: 1080,
      detectFreeze: false,
      runCommand: async () => ({
        stdout: JSON.stringify({ streams: [{ width: 720, height: 1280 }] }),
        stderr: "",
      }),
    })).rejects.toThrow("video_quality_resolution_below_minimum");
  });

  it("rejects freezes at or above one second", async () => {
    await expect(inspectVideoTechnicalQuality({
      videoPath: "/tmp/final.mp4",
      expectedAspectRatio: "9:16",
      minimumShortSide: 720,
      detectFreeze: true,
      runCommand: async (command) => command === "ffprobe"
        ? { stdout: JSON.stringify({ streams: [{ width: 1080, height: 1920 }] }), stderr: "" }
        : { stdout: "", stderr: "freeze_duration: 1.041" },
    })).rejects.toThrow("video_quality_freeze_detected");
  });
});
