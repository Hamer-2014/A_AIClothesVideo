import { describe, expect, it } from "vitest";

import { handleGetJobProgressRequest } from "./route";

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
    const response = await handleGetJobProgressRequest(
      new Request("http://localhost/api/jobs/job-1/progress"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        getProgress: async () => ({
          jobId: "job-1",
          status: "segment_generating",
          userVisibleStatus: "generating",
          phase: "generation",
          segmentProgress: {
            total: 2,
            queued: 0,
            generating: 1,
            succeeded: 1,
            failed: 0,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
          finalVideoKey: null,
          coverKey: null,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jobId: "job-1",
      phase: "generation",
      segmentProgress: { total: 2, generating: 1 },
    });
  });

  it("returns 404 when the job is not visible to the user", async () => {
    const response = await handleGetJobProgressRequest(
      new Request("http://localhost/api/jobs/job-1/progress"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        getProgress: async () => null,
      },
    );

    expect(response.status).toBe(404);
  });
});
