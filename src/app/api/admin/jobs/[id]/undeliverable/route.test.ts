import { describe, expect, it } from "vitest";

import { handleMarkUndeliverableRequest } from "./route";

describe("POST /api/admin/jobs/[id]/undeliverable", () => {
  it("requires admin access", async () => {
    const response = await handleMarkUndeliverableRequest(
      new Request("http://localhost/api/admin/jobs/job-1/undeliverable", {
        method: "POST",
        body: JSON.stringify({ reason: "cannot recover" }),
      }),
      { params: { id: "job-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("marks a job undeliverable", async () => {
    const response = await handleMarkUndeliverableRequest(
      new Request("http://localhost/api/admin/jobs/job-1/undeliverable", {
        method: "POST",
        body: JSON.stringify({ reason: "cannot recover" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        markUndeliverable: async (input) => ({
          jobId: input.jobId,
          status: "failed_released",
          ledgerType: "release",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      status: "failed_released",
      ledgerType: "release",
    });
  });

  it("rejects missing, whitespace-only, and short reasons", async () => {
    for (const reason of ["", "   ", "short"]) {
      const response = await handleMarkUndeliverableRequest(
        new Request("http://localhost/api/admin/jobs/job-1/undeliverable", {
          method: "POST",
          body: JSON.stringify({ reason }),
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

      expect(response.status).toBe(400);
    }
  });
});
