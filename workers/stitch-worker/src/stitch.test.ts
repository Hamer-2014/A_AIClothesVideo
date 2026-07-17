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
        postQaMode: "lite",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      },
      config: {
        workerSecret: "secret",
        callbackSecret: "callback-secret",
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
      extractCoverFrame: async ({ coverPath }) => {
        events.push(`cover:${coverPath}`);
      },
      extractQaFrames: async () => ["/tmp/stitch-1/frames/frame-1.jpg"],
      listExtractedQaFrames: async () => ["/tmp/stitch-1/frames/frame-1.jpg"],
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
      frameKeys: ["jobs/job-1/qa/frames/frame-1.jpg"],
    });
    expect(events).toContain("download:segments/a.mp4:/tmp/stitch-1/segment-0.mp4");
    expect(events).toContain(
      "upload:jobs/job-1/stitched/final.mp4:/tmp/stitch-1/final.mp4:video/mp4",
    );
    expect(events).toContain("cover:/tmp/stitch-1/cover.webp");
    expect(events).toContain(
      "upload:jobs/job-1/covers/cover.webp:/tmp/stitch-1/cover.webp:image/webp",
    );
    expect(events).toContain("callback:succeeded");
    expect(events).toContain("cleanup:/tmp/stitch-1");
  });

  it("continues delivery when cover extraction fails", async () => {
    const callbacks: unknown[] = [];
    const uploads: string[] = [];

    const result = await runStitchJob({
      payload: {
        stitchJobId: "stitch-1",
        videoJobId: "job-1",
        segmentKeys: ["segments/a.mp4"],
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        coverKey: "jobs/job-1/covers/cover.webp",
        frameKeyPrefix: "jobs/job-1/qa/frames",
        postQaMode: "lite",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      },
      config: {
        workerSecret: "secret",
        callbackSecret: "callback-secret",
        bucket: "bucket",
        r2Endpoint: "https://account.r2.cloudflarestorage.com",
        r2AccessKeyId: "access",
        r2SecretAccessKey: "private",
      },
      createWorkDir: async () => "/tmp/stitch-1",
      writeTextFile: async () => {},
      downloadObject: async () => {},
      uploadObject: async ({ key }) => {
        uploads.push(key);
      },
      stitchSegments: async () => {},
      extractCoverFrame: async () => {
        throw new Error("cover failed");
      },
      extractQaFrames: async () => ["/tmp/stitch-1/frames/frame-1.jpg"],
      listExtractedQaFrames: async () => ["/tmp/stitch-1/frames/frame-1.jpg"],
      sendCallback: async ({ result }) => {
        callbacks.push(result);
      },
      cleanupWorkDir: async () => {},
    });

    expect(result).toMatchObject({
      status: "succeeded",
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      coverKey: null,
    });
    expect(uploads).toContain("jobs/job-1/stitched/final.mp4");
    expect(uploads).not.toContain("jobs/job-1/covers/cover.webp");
    expect(callbacks[0]).toMatchObject({
      status: "succeeded",
      coverKey: null,
      warnings: ["cover_generation_failed: cover failed"],
    });
  });

  it("continues delivery when cover upload fails", async () => {
    const uploads: string[] = [];
    const callbacks: unknown[] = [];

    const result = await runStitchJob({
      payload: {
        stitchJobId: "stitch-1",
        videoJobId: "job-1",
        segmentKeys: ["segments/a.mp4"],
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        coverKey: "jobs/job-1/covers/cover.webp",
        frameKeyPrefix: "jobs/job-1/qa/frames",
        postQaMode: "lite",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      },
      config: {
        workerSecret: "secret",
        callbackSecret: "callback-secret",
        bucket: "bucket",
        r2Endpoint: "https://account.r2.cloudflarestorage.com",
        r2AccessKeyId: "access",
        r2SecretAccessKey: "private",
      },
      createWorkDir: async () => "/tmp/stitch-1",
      writeTextFile: async () => {},
      downloadObject: async () => {},
      uploadObject: async ({ key }) => {
        uploads.push(key);
        if (key.endsWith("cover.webp")) {
          throw new Error("cover upload failed");
        }
      },
      stitchSegments: async () => {},
      extractCoverFrame: async () => {},
      extractQaFrames: async () => ["/tmp/stitch-1/frames/frame-0.jpg"],
      listExtractedQaFrames: async () => ["/tmp/stitch-1/frames/frame-0.jpg"],
      sendCallback: async ({ result }) => {
        callbacks.push(result);
      },
      cleanupWorkDir: async () => {},
    });

    expect(result).toMatchObject({
      status: "succeeded",
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      coverKey: null,
    });
    expect(uploads).toContain("jobs/job-1/stitched/final.mp4");
    expect(uploads).toContain("jobs/job-1/covers/cover.webp");
    expect(callbacks[0]).toMatchObject({
      status: "succeeded",
      coverKey: null,
      warnings: ["cover_upload_failed: cover upload failed"],
    });
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
          postQaMode: "lite",
          callbackUrl: "https://app.example.com/api/internal/stitch/callback",
        },
        config: {
          workerSecret: "secret",
          callbackSecret: "callback-secret",
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
        listExtractedQaFrames: async () => [],
        sendCallback: async ({ result }) => {
          callbacks.push(`${result.status}:${result.errorMessage}`);
        },
        cleanupWorkDir: async () => {},
      }),
    ).rejects.toThrow("ffmpeg failed");

    expect(callbacks).toEqual(["failed:ffmpeg failed"]);
  });

  it("uses the post QA mode to build a frame plan", async () => {
    const framePlanLengths: number[] = [];

    await runStitchJob({
      payload: {
        stitchJobId: "stitch-1",
        videoJobId: "job-1",
        segmentKeys: ["segments/a.mp4"],
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        coverKey: null,
        frameKeyPrefix: "jobs/job-1/qa/frames",
        postQaMode: "strict",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      },
      config: {
        workerSecret: "secret",
        callbackSecret: "callback-secret",
        bucket: "bucket",
        r2Endpoint: "https://account.r2.cloudflarestorage.com",
        r2AccessKeyId: "access",
        r2SecretAccessKey: "private",
      },
      createWorkDir: async () => "/tmp/stitch-1",
      writeTextFile: async () => {},
      downloadObject: async () => {},
      uploadObject: async () => {},
      stitchSegments: async () => {},
      extractQaFrames: async ({ framePlan }) => {
        framePlanLengths.push(framePlan.length);
        return framePlan.map(
          (point) =>
            `/tmp/stitch-1/frames/segment-${point.segmentIndex}-frame-${point.frameIndex}.jpg`,
        );
      },
      listExtractedQaFrames: async () => [
        "/tmp/stitch-1/frames/frame-1.jpg",
        "/tmp/stitch-1/frames/frame-2.jpg",
        "/tmp/stitch-1/frames/frame-3.jpg",
        "/tmp/stitch-1/frames/frame-4.jpg",
        "/tmp/stitch-1/frames/frame-5.jpg",
        "/tmp/stitch-1/frames/frame-6.jpg",
      ],
      sendCallback: async () => {},
      cleanupWorkDir: async () => {},
    });

    expect(framePlanLengths).toEqual([6]);
  });

  it("uploads 34 named Strict frames for five segments", async () => {
    const uploads: string[] = [];
    const result = await runStitchJob({
      payload: {
        stitchJobId: "stitch-40",
        videoJobId: "job-40",
        segmentKeys: Array.from({ length: 5 }, (_, index) => `segments/${index}.mp4`),
        finalVideoKey: "jobs/job-40/stitched/final.mp4",
        coverKey: null,
        frameKeyPrefix: "jobs/job-40/qa/frames",
        postQaMode: "strict",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      },
      config: {
        workerSecret: "secret",
        callbackSecret: "callback-secret",
        bucket: "bucket",
        r2Endpoint: "https://account.r2.cloudflarestorage.com",
        r2AccessKeyId: "access",
        r2SecretAccessKey: "private",
      },
      createWorkDir: async () => "/tmp/stitch-40",
      writeTextFile: async () => {},
      downloadObject: async () => {},
      uploadObject: async ({ key }) => {
        uploads.push(key);
      },
      stitchSegments: async () => {},
      extractQaFrames: async ({ framePlan }) =>
        framePlan.map((point) =>
          point.kind === "transition"
            ? `/tmp/stitch-40/frames/transition-${point.segmentIndex}-${point.segmentIndex + 1}.jpg`
            : `/tmp/stitch-40/frames/segment-${point.segmentIndex}-frame-${point.frameIndex}.jpg`,
        ),
      sendCallback: async () => {},
      cleanupWorkDir: async () => {},
    });

    expect(result.status).toBe("succeeded");
    expect(result.frameKeys).toHaveLength(34);
    expect(result.frameKeys).toContain(
      "jobs/job-40/qa/frames/transition-0-1.jpg",
    );
    expect(uploads.filter((key) => key.includes("/qa/frames/"))).toHaveLength(34);
  });
});
