import { describe, expect, it } from "vitest";

import { handleCreateJobRequest } from "./route";

describe("POST /api/jobs", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleCreateJobRequest(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-1"],
          durationSeconds: 8,
          aspectRatio: "9:16",
          isTrial: true,
        }),
      }),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("creates a video job for authenticated users", async () => {
    const response = await handleCreateJobRequest(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-1"],
          durationSeconds: 8,
          aspectRatio: "9:16",
          isTrial: true,
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createJob: async (input) => ({
          job: {
            id: "job-1",
            userId: input.userId,
            status: "asset_analysis_queued",
            userVisibleStatus: "analyzing_assets",
            durationSeconds: input.durationSeconds,
            aspectRatio: "9:16",
            postQaMode: "lite",
            postQaRequired: "true",
            creditCost: 0,
            isTest: false,
          },
          jobAssets: [
            {
              id: "job-asset-1",
              videoJobId: "job-1",
              assetId: "asset-1",
              role: "front",
              sortOrder: 0,
            },
          ],
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      jobId: "job-1",
      status: "asset_analysis_queued",
      userVisibleStatus: "analyzing_assets",
      assetCount: 1,
    });
  });

  it("returns 400 for invalid job input", async () => {
    const response = await handleCreateJobRequest(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          assetIds: [],
          durationSeconds: 8,
          aspectRatio: "9:16",
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_job_input" });
  });
});
