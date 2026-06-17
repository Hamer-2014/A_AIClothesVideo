import { describe, expect, it } from "vitest";

import { handleGetTrialStatusRequest } from "./route";

describe("GET /api/trial/status", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleGetTrialStatusRequest(
      new Request("http://localhost/api/trial/status"),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns the authenticated user's visible trial status", async () => {
    const seenInputs: unknown[] = [];
    const response = await handleGetTrialStatusRequest(
      new Request("http://localhost/api/trial/status", {
        headers: {
          "x-forwarded-for": "203.0.113.20, 10.0.0.1",
          "user-agent": "Vitest Browser",
        },
      }),
      {
        getSession: async () => ({
          user: {
            id: "user-1",
            email: "seller@example.com",
            emailVerified: true,
          },
        }),
        getTrialStatus: async (input) => {
          seenInputs.push(input);
          return {
            state: "available",
            message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
            limits: {
              durationSeconds: 8,
              qualityLabel: "低分辨率",
              audioLabel: "无音频",
              watermarkEnabled: true,
            },
          };
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      state: "available",
      message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
      limits: {
        durationSeconds: 8,
        qualityLabel: "低分辨率",
        audioLabel: "无音频",
        watermarkEnabled: true,
      },
    });
    expect(seenInputs[0]).toMatchObject({
      userId: "user-1",
      email: "seller@example.com",
      emailVerified: true,
      requestContext: {
        ipAddress: "203.0.113.20",
        userAgent: "Vitest Browser",
        path: "/api/trial/status",
      },
    });
  });

  it("passes device fingerprint from query into visible trial status lookup", async () => {
    const seenInputs: unknown[] = [];
    const response = await handleGetTrialStatusRequest(
      new Request(
        "http://localhost/api/trial/status?deviceFingerprint=device-query-1",
        {
          headers: {
            "user-agent": "Vitest Browser",
          },
        },
      ),
      {
        getSession: async () => ({
          user: {
            id: "user-1",
            email: "seller@example.com",
            emailVerified: true,
          },
        }),
        getTrialStatus: async (input) => {
          seenInputs.push(input);
          return {
            state: "available",
            message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
            limits: {
              durationSeconds: 8,
              qualityLabel: "低分辨率",
              audioLabel: "无音频",
              watermarkEnabled: true,
            },
          };
        },
      },
    );

    expect(response.status).toBe(200);
    expect(seenInputs[0]).toMatchObject({
      requestContext: {
        deviceFingerprint: "device-query-1",
      },
    });
  });

  it("falls back to the device fingerprint header when query is absent", async () => {
    const seenInputs: unknown[] = [];
    const response = await handleGetTrialStatusRequest(
      new Request("http://localhost/api/trial/status", {
        headers: {
          "x-device-fingerprint": "device-header-1",
          "user-agent": "Vitest Browser",
        },
      }),
      {
        getSession: async () => ({
          user: { id: "user-1" },
        }),
        getTrialStatus: async (input) => {
          seenInputs.push(input);
          return {
            state: "unavailable",
            message: "当前账号暂时无法使用免费试用，可以购买点数继续生成。",
            limits: null,
          };
        },
      },
    );

    expect(response.status).toBe(200);
    expect(seenInputs[0]).toMatchObject({
      requestContext: {
        deviceFingerprint: "device-header-1",
      },
    });
  });

  it("does not expose internal trial denial details", async () => {
    const response = await handleGetTrialStatusRequest(
      new Request("http://localhost/api/trial/status"),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        getTrialStatus: async () => ({
          state: "unavailable",
          message: "当前账号暂时无法使用免费试用，可以购买点数继续生成。",
          limits: null,
        }),
      },
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      state: "unavailable",
      message: "当前账号暂时无法使用免费试用，可以购买点数继续生成。",
      limits: null,
    });
    expect(serialized).not.toContain("riskScore");
    expect(serialized).not.toContain("reasonCodes");
    expect(serialized).not.toContain("email_trial_used");
    expect(serialized).not.toContain("hash");
  });
});
