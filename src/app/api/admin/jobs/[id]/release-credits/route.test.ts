import { describe, expect, it } from "vitest";

import { handleReleaseJobCreditsRequest } from "./route";

describe("POST /api/admin/jobs/[id]/release-credits", () => {
  it("requires admin access", async () => {
    const response = await handleReleaseJobCreditsRequest(
      new Request("http://localhost/api/admin/jobs/job-1/release-credits", {
        method: "POST",
        body: JSON.stringify({ reason: "release failed job" }),
      }),
      { params: { id: "job-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("releases credits for admins/operators", async () => {
    const response = await handleReleaseJobCreditsRequest(
      new Request("http://localhost/api/admin/jobs/job-1/release-credits", {
        method: "POST",
        body: JSON.stringify({ reason: "release failed job" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        releaseCredits: async (input) => ({
          jobId: input.jobId,
          status: "failed_released",
          ledgerType: "release",
          idempotent: false,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      status: "failed_released",
      ledgerType: "release",
      idempotent: false,
    });
  });

  it("rejects short reasons and non-releaseable jobs", async () => {
    const invalid = await handleReleaseJobCreditsRequest(
      new Request("http://localhost/api/admin/jobs/job-1/release-credits", {
        method: "POST",
        body: JSON.stringify({ reason: "bad" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
      },
    );
    expect(invalid.status).toBe(400);

    const conflict = await handleReleaseJobCreditsRequest(
      new Request("http://localhost/api/admin/jobs/job-1/release-credits", {
        method: "POST",
        body: JSON.stringify({ reason: "release failed job" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        releaseCredits: async () => {
          throw new Error("Video job credits cannot be released in this state.");
        },
      },
    );
    expect(conflict.status).toBe(409);
  });
});
