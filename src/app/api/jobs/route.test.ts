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
          useFreeTrialIfAvailable: true,
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
          useFreeTrialIfAvailable: true,
        }),
        headers: {
          "x-forwarded-for": "203.0.113.20, 10.0.0.1",
          "user-agent": "Vitest Browser",
        },
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
            billingMode: "free_trial",
            generationProfile: "trial_540p_watermarked",
            watermarkEnabled: true,
            trialEligibilitySnapshot: null,
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

  it("does not forward client isTrial as billing authority", async () => {
    const seenInputs: unknown[] = [];
    const response = await handleCreateJobRequest(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-1"],
          durationSeconds: 8,
          aspectRatio: "9:16",
          isTrial: true,
          useFreeTrialIfAvailable: false,
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createJob: async (input) => {
          seenInputs.push(input);
          return {
            job: {
              id: "job-1",
              userId: input.userId,
              status: "asset_analysis_queued",
              userVisibleStatus: "analyzing_assets",
              durationSeconds: input.durationSeconds,
              aspectRatio: "9:16",
              postQaMode: "standard",
              postQaRequired: "true",
              creditCost: 70,
              billingMode: "paid",
              generationProfile: "paid_720p_audio",
              watermarkEnabled: false,
              trialEligibilitySnapshot: null,
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
          };
        },
      },
    );

    expect(response.status).toBe(201);
    expect(seenInputs[0]).toMatchObject({
      userId: "user-1",
      useFreeTrialIfAvailable: false,
    });
    expect(seenInputs[0]).not.toHaveProperty("isTrial");
  });

  it("maps unavailable explicit free trial requests to a clear conflict response", async () => {
    const response = await handleCreateJobRequest(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-1"],
          durationSeconds: 8,
          aspectRatio: "9:16",
          useFreeTrialIfAvailable: true,
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createJob: async () => {
          throw new Error("Free trial is not available.");
        },
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "free_trial_unavailable",
      message: "免费试用暂不可用，请选择付费生成。",
    });
  });

  it("passes request IP and user agent context to job creation", async () => {
    const seenInputs: unknown[] = [];

    await handleCreateJobRequest(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-1"],
          durationSeconds: 8,
          aspectRatio: "9:16",
        }),
        headers: {
          "x-forwarded-for": "198.51.100.5, 10.0.0.2",
          "user-agent": "Vitest Browser",
        },
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createJob: async (input) => {
          seenInputs.push(input);
          return {
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
              billingMode: "free_trial",
              generationProfile: "trial_540p_watermarked",
              watermarkEnabled: true,
              trialEligibilitySnapshot: null,
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
          };
        },
      },
    );

    expect(seenInputs[0]).toMatchObject({
      requestContext: {
        ipAddress: "198.51.100.5",
        userAgent: "Vitest Browser",
        path: "/api/jobs",
      },
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

  it("returns diagnostic message for unexpected creation failures", async () => {
    const response = await handleCreateJobRequest(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-1"],
          durationSeconds: 8,
          aspectRatio: "9:16",
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createJob: async () => {
          throw new Error('relation "free_trial_usages" does not exist');
        },
      },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "job_creation_failed",
      message: 'relation "free_trial_usages" does not exist',
    });
  });
});
