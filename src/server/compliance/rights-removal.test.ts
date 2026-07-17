import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryRightsRemovalStore,
  normalizeContentReference,
  parseRightsRemovalInput,
  submitRightsRemovalRequest,
} from "./rights-removal";

const validInput = {
  reporterName: "权利人",
  reporterEmail: "owner@example.com",
  rightsType: "likeness",
  contentReferences: [
    "https://app.example/jobs/job-1?token=secret#preview",
  ],
  description:
    "我是相关人物的合法权利人，该内容未经授权使用了人物肖像，请核验并处理对应内容。此说明仅用于自动化测试。",
  goodFaithConfirmed: true,
  accuracyConfirmed: true,
};

describe("rights removal input", () => {
  it("strips signed query and fragment data", () => {
    expect(
      normalizeContentReference(
        "https://app.example/jobs/job-1?token=secret#preview",
      ),
    ).toBe("https://app.example/jobs/job-1");
  });

  it("requires both legal declarations", () => {
    expect(() =>
      parseRightsRemovalInput({
        ...validInput,
        accuracyConfirmed: false,
      }),
    ).toThrow("invalid_rights_removal_input");
  });

  it("rate limits the sixth request from one IP hash within 24 hours", async () => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const store = createInMemoryRightsRemovalStore({
      recentIpHashCount: 5,
    });

    await expect(
      submitRightsRemovalRequest({
        store,
        input: validInput,
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        appEnvironment: "production",
        hashSecret: "hash-secret",
        now,
        notifyLegal: vi.fn(),
        recordNotificationFailure: vi.fn(),
      }),
    ).rejects.toThrow("rights_removal_rate_limited");
    expect(store.listRequests()).toHaveLength(0);
  });

  it("fails closed without a production hash secret", async () => {
    await expect(
      submitRightsRemovalRequest({
        store: createInMemoryRightsRemovalStore(),
        input: validInput,
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        appEnvironment: "production",
        hashSecret: "",
        notifyLegal: vi.fn(),
        recordNotificationFailure: vi.fn(),
      }),
    ).rejects.toThrow("compliance_hash_secret_required");
  });

  it("keeps the saved case when notification fails", async () => {
    const store = createInMemoryRightsRemovalStore();
    const recordNotificationFailure = vi.fn();

    const result = await submitRightsRemovalRequest({
      store,
      input: validInput,
      ipAddress: "203.0.113.10",
      userAgent: "Vitest Browser",
      appEnvironment: "test",
      hashSecret: "hash-secret",
      now: new Date("2026-07-11T00:00:00.000Z"),
      notifyLegal: async () => {
        throw new Error("resend unavailable");
      },
      recordNotificationFailure,
    });

    expect(result).toEqual({
      accepted: true,
      reference: expect.stringMatching(/^RR-[A-Z0-9_-]+$/),
    });
    expect(store.listRequests()).toHaveLength(1);
    expect(store.listRequests()[0]).toMatchObject({
      publicReference: result.reference,
      contentReferences: ["https://app.example/jobs/job-1"],
      status: "received",
    });
    expect(recordNotificationFailure).toHaveBeenCalledWith({
      publicReference: result.reference,
      errorCode: "rights_removal_notification_failed",
      errorMessage: "resend unavailable",
    });
  });
});
