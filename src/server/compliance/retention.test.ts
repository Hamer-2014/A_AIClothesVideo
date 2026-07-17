import { describe, expect, it } from "vitest";

import type { RightsRemovalRequestRecord } from "./rights-removal";
import {
  createInMemoryComplianceRetentionStore,
  redactExpiredComplianceData,
} from "./retention";

function rightsRemovalRequest(
  overrides: Partial<RightsRemovalRequestRecord> = {},
): RightsRemovalRequestRecord {
  const createdAt = new Date("2027-01-01T00:00:00.000Z");
  return {
    id: "request-default",
    publicReference: "RR-DEFAULT",
    status: "received",
    reporterName: "举报人",
    reporterEmail: "reporter@example.com",
    rightsType: "likeness",
    contentReferences: ["https://app.example/jobs/job-1"],
    description:
      "用于保留期测试的有效权利说明内容，长度超过五十个字符并且不包含任何真实敏感信息。",
    goodFaithConfirmed: true,
    accuracyConfirmed: true,
    ipHash: "ip-hash",
    userAgentHash: "ua-hash",
    resolutionSummary: null,
    resolvedAt: null,
    redactedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("compliance retention", () => {
  it("redacts resolved cases older than three years", async () => {
    const now = new Date("2030-07-11T00:00:00.000Z");
    const store = createInMemoryComplianceRetentionStore({
      removalRequests: [
        rightsRemovalRequest({
          id: "request-old",
          status: "resolved_removed",
          resolvedAt: new Date("2027-07-10T00:00:00.000Z"),
          reporterName: "权利人",
          reporterEmail: "owner@example.com",
        }),
        rightsRemovalRequest({
          id: "request-recent",
          status: "resolved_rejected",
          resolvedAt: new Date("2029-07-10T00:00:00.000Z"),
        }),
      ],
    });

    const result = await redactExpiredComplianceData({ store, now, limit: 100 });

    expect(result.removalRequestCount).toBe(1);
    expect(store.listRemovalRequests()[0]).toMatchObject({
      reporterName: "[REDACTED]",
      reporterEmail: "[REDACTED]",
      contentReferences: [],
      description: "[REDACTED]",
      ipHash: null,
      userAgentHash: null,
      redactedAt: now,
    });
    expect(store.listRemovalRequests()[1]?.redactedAt).toBeNull();
  });

  it("redacts old attestations only when all linked assets are deleted", async () => {
    const now = new Date("2030-07-11T00:00:00.000Z");
    const store = createInMemoryComplianceRetentionStore({
      attestations: [
        {
          id: "attestation-deleted-assets",
          userId: "user-1",
          acceptedAt: new Date("2027-07-10T00:00:00.000Z"),
          ipHash: "ip-hash",
          userAgentHash: "ua-hash",
          redactedAt: null,
          linkedAssetDeletedAt: [new Date("2028-01-01T00:00:00.000Z")],
        },
        {
          id: "attestation-active-asset",
          userId: "user-2",
          acceptedAt: new Date("2027-07-10T00:00:00.000Z"),
          ipHash: "ip-hash",
          userAgentHash: "ua-hash",
          redactedAt: null,
          linkedAssetDeletedAt: [null],
        },
      ],
    });

    const first = await redactExpiredComplianceData({ store, now });
    const second = await redactExpiredComplianceData({ store, now });

    expect(first.attestationCount).toBe(1);
    expect(second.attestationCount).toBe(0);
    expect(store.listAttestations()[0]).toMatchObject({
      userId: "[REDACTED]",
      ipHash: null,
      userAgentHash: null,
      redactedAt: now,
    });
    expect(store.listAttestations()[1]?.redactedAt).toBeNull();
  });
});
