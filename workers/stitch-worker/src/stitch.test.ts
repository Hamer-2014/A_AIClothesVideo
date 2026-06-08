import { describe, expect, it } from "vitest";

import { runStitchJob } from "./stitch.js";

describe("runStitchJob", () => {
  it("downloads segments, stitches them, uploads outputs, and callbacks the app", async () => {
    const events: string[] = [];

    const result = await runStitchJob({
      payload: {
        stitchJobId: "stitch-1",
        videoJobId: "job-1",
        segmentKeys: ["segments/a.mp4", "segments/b.mp4"],
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        coverKey: "jobs/job-1/covers/cover.webp",
        frameKeyPrefix: "jobs/job-1/qa/frames",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      },
      config: {
        workerSecret: "secret",
        bucket: "bucket",
        r2Endpoint: "https://account.r2.cloudflarestorage.com",
        r2AccessKeyId: "access",
        r2SecretAccessKey: "private",
      },
      createWorkDir: async () => "/tmp/stitch-1",
      writeTextFile: async (path, contents) => {
        events.push(`write:${path}:${contents.includes("segments")}`);
      },
      downloadObject: async ({ key, destinationPath }) => {
        events.push(`download:${key}:${destinationPath}`);
      },
      uploadObject: async ({ key, sourcePath, contentType }) => {
        events.push(`upload:${key}:${sourcePath}:${contentType}`);
      },
      stitchSegments: async ({ concatListPath, outputPath }) => {
        events.push(`stitch:${concatListPath}:${outputPath}`);
      },
      extractQaFrames: async () => ["/tmp/stitch-1/frames/frame-0.jpg"],
      sendCallback: async ({ result: callbackResult }) => {
        events.push(`callback:${callbackResult.status}`);
      },
      cleanupWorkDir: async (path) => {
        events.push(`cleanup:${path}`);
      },
    });

    expect(result).toEqual({
      stitchJobId: "stitch-1",
      status: "succeeded",
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      coverKey: "jobs/job-1/covers/cover.webp",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
    });
    expect(events).toContain("download:segments/a.mp4:/tmp/stitch-1/segment-0.mp4");
    expect(events).toContain(
      "upload:jobs/job-1/stitched/final.mp4:/tmp/stitch-1/final.mp4:video/mp4",
    );
    expect(events).toContain("callback:succeeded");
    expect(events).toContain("cleanup:/tmp/stitch-1");
  });

  it("callbacks a failed result before rethrowing stitch errors", async () => {
    const callbacks: string[] = [];

    await expect(
      runStitchJob({
        payload: {
          stitchJobId: "stitch-1",
          videoJobId: "job-1",
          segmentKeys: ["segments/a.mp4"],
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: null,
          frameKeyPrefix: null,
          callbackUrl: "https://app.example.com/api/internal/stitch/callback",
        },
        config: {
          workerSecret: "secret",
          bucket: "bucket",
          r2Endpoint: "https://account.r2.cloudflarestorage.com",
          r2AccessKeyId: "access",
          r2SecretAccessKey: "private",
        },
        createWorkDir: async () => "/tmp/stitch-1",
        writeTextFile: async () => {},
        downloadObject: async () => {},
        uploadObject: async () => {},
        stitchSegments: async () => {
          throw new Error("ffmpeg failed");
        },
        extractQaFrames: async () => [],
        sendCallback: async ({ result }) => {
          callbacks.push(`${result.status}:${result.errorMessage}`);
        },
        cleanupWorkDir: async () => {},
      }),
    ).rejects.toThrow("ffmpeg failed");

    expect(callbacks).toEqual(["failed:ffmpeg failed"]);
  });
});
