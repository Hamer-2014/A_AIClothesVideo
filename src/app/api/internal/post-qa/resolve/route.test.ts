import { describe, expect, it } from "vitest";

import { handleResolvePostQaRequest } from "./route";

describe("POST /api/internal/post-qa/resolve", () => {
  it("requires internal authorization", async () => {
    const response = await handleResolvePostQaRequest(
      new Request("http://localhost/api/internal/post-qa/resolve", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1", status: "passed" }),
      }),
      {
        expectedSecret: "secret",
      },
    );

    expect(response.status).toBe(401);
  });

  it("resolves post QA result when authorized", async () => {
    const response = await handleResolvePostQaRequest(
      new Request("http://localhost/api/internal/post-qa/resolve", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: JSON.stringify({
          jobId: "job-1",
          status: "passed",
          mode: "standard",
          frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
          resultJson: { passed: true },
        }),
      }),
      {
        expectedSecret: "secret",
        resolvePostQa: async (input) => ({
          jobId: input.jobId,
          status: "deliverable",
          ledgerType: "capture",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      status: "deliverable",
      ledgerType: "capture",
    });
  });
});
