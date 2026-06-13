import { describe, expect, it } from "vitest";

import { handleGetJobProgressRequest } from "./route";

const progressFixture = {
  jobId: "job-1",
  status: "segment_generating",
  userVisibleStatus: "generating",
  message: null,
  phase: "generation",
  segmentProgress: {
    total: 1,
    queued: 0,
    generating: 1,
    succeeded: 0,
    failed: 0,
  },
  stitching: { status: "not_started" },
  postQa: { status: "not_started" },
  creditCost: 70,
  billingMode: "paid",
  creditStatus: "reserved",
  downloadReady: false,
  finalVideoKey: null,
  coverKey: null,
};

describe("GET /api/jobs/[id]/progress", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleGetJobProgressRequest(
      new Request("http://localhost/api/jobs/job-1/progress"),
      { params: { id: "job-1" } },
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns job progress for the owner", async () => {
    const refreshed: string[] = [];
    const response = await handleGetJobProgressRequest(
      new Request("http://localhost/api/jobs/job-1/progress"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        refreshGeneration: async ({ jobId }) => {
          refreshed.push(jobId);
        },
        getProgress: async () => ({
          ...progressFixture,
          segmentProgress: {
            total: 2,
            queued: 0,
            generating: 1,
            succeeded: 1,
            failed: 0,
          },
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(refreshed).toEqual(["job-1"]);
    expect(await response.json()).toMatchObject({
      jobId: "job-1",
      phase: "generation",
      creditStatus: "reserved",
      segmentProgress: { total: 2, generating: 1 },
    });
  });

  it("still returns current progress when generation refresh fails", async () => {
    const response = await handleGetJobProgressRequest(
      new Request("http://localhost/api/jobs/job-1/progress"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        refreshGeneration: async () => {
          throw new Error("APIMart poll timeout.");
        },
        getProgress: async () => progressFixture,
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jobId: "job-1",
      status: "segment_generating",
    });
  });

  it("returns 404 when the job is not visible to the user", async () => {
    let refreshed = false;
    const response = await handleGetJobProgressRequest(
      new Request("http://localhost/api/jobs/job-1/progress"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        refreshGeneration: async () => {
          refreshed = true;
        },
        getProgress: async () => null,
      },
    );

    expect(response.status).toBe(404);
    expect(refreshed).toBe(false);
  });
});
