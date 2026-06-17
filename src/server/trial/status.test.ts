import { describe, expect, it } from "vitest";

import type { TrialEligibilityStore } from "@/server/abuse/trial-eligibility";

import { getUserVisibleTrialStatus } from "./status";

function trialStatusStore({
  userTrialCount = 0,
  signals = [],
}: {
  userTrialCount?: number;
  signals?: unknown[];
} = {}): TrialEligibilityStore {
  return {
    countTrialUsagesByUserId: async () => userTrialCount,
    countTrialUsagesByEmailHash: async () => 0,
    countTrialUsagesByOauthAccount: async () => 0,
    countRecentTrialSignalsByDevice: async () => 0,
    countRecentTrialSignalsByIp: async () => 0,
    countRecentTrialSignalsByIpAndUserAgent: async () => 0,
    createTrialAbuseSignal: async (input) => {
      signals.push(input);
    },
  };
}

describe("getUserVisibleTrialStatus", () => {
  it("returns available when the user has no previous trial and eligibility allows", async () => {
    const status = await getUserVisibleTrialStatus({
      store: trialStatusStore(),
      evaluateEligibility: async () => ({
        decision: "allow",
        riskScore: 0,
        reasonCodes: [],
        signalSnapshot: { source: "test" },
      }),
      input: { userId: "user-1" },
    });

    expect(status).toEqual({
      state: "available",
      message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
      limits: {
        durationSeconds: 8,
        qualityLabel: "低分辨率",
        audioLabel: "无音频",
        watermarkEnabled: true,
      },
    });
  });

  it("returns used when the user already has a historical trial", async () => {
    const status = await getUserVisibleTrialStatus({
      store: trialStatusStore({ userTrialCount: 1 }),
      evaluateEligibility: async () => {
        throw new Error("eligibility should not run after historical usage");
      },
      input: { userId: "user-1" },
    });

    expect(status).toEqual({
      state: "used",
      message: "你的免费试用已使用。可以购买点数生成高清无水印视频。",
      limits: null,
    });
  });

  it("returns unavailable when risk or eligibility denies trial access", async () => {
    const status = await getUserVisibleTrialStatus({
      store: trialStatusStore(),
      evaluateEligibility: async () => ({
        decision: "deny",
        riskScore: 100,
        reasonCodes: ["email_trial_used", "ip_trial_limit"],
        signalSnapshot: {
          emailHash: "hash",
          deviceFingerprintHash: "device-hash",
        },
      }),
      input: { userId: "user-1" },
    });

    expect(status).toEqual({
      state: "unavailable",
      message: "当前账号暂时无法使用免费试用，可以购买点数继续生成。",
      limits: null,
    });
  });

  it("does not expose risk scores, hashes, or internal reason codes", async () => {
    const status = await getUserVisibleTrialStatus({
      store: trialStatusStore(),
      evaluateEligibility: async () => ({
        decision: "review",
        riskScore: 45,
        reasonCodes: ["missing_device_fingerprint"],
        signalSnapshot: {
          emailHash: "hash",
          ipHash: "ip-hash",
        },
      }),
      input: { userId: "user-1" },
    });
    const serialized = JSON.stringify(status);

    expect(status.state).toBe("unavailable");
    expect(serialized).not.toContain("riskScore");
    expect(serialized).not.toContain("reasonCodes");
    expect(serialized).not.toContain("missing_device_fingerprint");
    expect(serialized).not.toContain("hash");
  });

  it("does not write trial abuse signals while only checking visible status", async () => {
    const signals: unknown[] = [];

    await getUserVisibleTrialStatus({
      store: trialStatusStore({ signals }),
      input: {
        userId: "user-1",
        email: "seller@example.com",
        emailVerified: true,
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        deviceFingerprint: "device-1",
      },
    });

    expect(signals).toHaveLength(0);
  });
});
