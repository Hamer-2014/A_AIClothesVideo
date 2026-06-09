import { describe, expect, it } from "vitest";

import { handleCreateStitchJobRequest } from "./route";

describe("POST /api/internal/stitch/jobs", () => {
  it("requires internal authorization", async () => {
    const response = await handleCreateStitchJobRequest(
      new Request("http://localhost/api/internal/stitch/jobs", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      {
        expectedSecret: "secret",
      },
    );

    expect(response.status).toBe(401);
  });

  it("creates a stitch job when authorized", async () => {
    const triggered: unknown[] = [];
    const markedRunning: string[] = [];
    const calls: string[] = [];
    const response = await handleCreateStitchJobRequest(
      new Request("http://localhost/api/internal/stitch/jobs", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      {
        expectedSecret: "secret",
        createStitchJob: async (input) => ({
          jobId: input.jobId,
          stitchJobId: "stitch-1",
          status: "queued",
          segmentCount: 2,
          segmentKeys: ["jobs/job-1/segments/segment-1/video.mp4"],
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: "jobs/job-1/covers/cover.webp",
          frameKeyPrefix: "jobs/job-1/qa/frames",
          callbackUrl: "http://localhost/api/internal/stitch/callback",
        }),
        triggerCloudRun: async (payload) => {
          calls.push("trigger");
          triggered.push(payload);
          return { accepted: true };
        },
        markRunning: async (input) => {
          calls.push("mark-running");
          markedRunning.push(input.stitchJobId);
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      stitchJobId: "stitch-1",
      status: "queued",
      segmentCount: 2,
      cloudRun: { accepted: true },
    });
    expect(triggered).toHaveLength(1);
    expect(markedRunning).toEqual(["stitch-1"]);
    expect(calls).toEqual(["mark-running", "trigger"]);
  });

  it("returns a bad gateway response when Cloud Run cannot be triggered", async () => {
    const response = await handleCreateStitchJobRequest(
      new Request("http://localhost/api/internal/stitch/jobs", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      {
        expectedSecret: "secret",
        createStitchJob: async () => ({
          jobId: "job-1",
          stitchJobId: "stitch-1",
          status: "queued",
          segmentCount: 1,
          segmentKeys: ["jobs/job-1/segments/segment-1/video.mp4"],
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: "jobs/job-1/covers/cover.webp",
          frameKeyPrefix: "jobs/job-1/qa/frames",
          callbackUrl: "http://localhost/api/internal/stitch/callback",
        }),
        triggerCloudRun: async () => {
          throw new Error("Cloud Run is down.");
        },
      },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "cloud_run_trigger_failed" });
  });
});
