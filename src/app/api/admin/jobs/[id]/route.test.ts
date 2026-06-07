import { describe, expect, it } from "vitest";

import { handleGetAdminJobRequest } from "./route";

describe("GET /api/admin/jobs/[id]", () => {
  it("returns 403 for non-admin users", async () => {
    const response = await handleGetAdminJobRequest(
      new Request("http://localhost/api/admin/jobs/job-1"),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => null,
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns admin job detail", async () => {
    const response = await handleGetAdminJobRequest(
      new Request("http://localhost/api/admin/jobs/job-1"),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
        getJobDetail: async (input) => ({
          job: {
            id: input.jobId,
            status: "segments_queued",
          },
          segments: [],
          providerLogs: [],
          moderationResults: [],
          ledger: [],
          stitchJobs: [],
          postQaResults: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      job: {
        id: "job-1",
        status: "segments_queued",
      },
      segments: [],
      providerLogs: [],
      moderationResults: [],
      ledger: [],
      stitchJobs: [],
      postQaResults: [],
    });
  });
});
