import { describe, expect, it } from "vitest";

import { grantTrialCredits, reserveCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";
import {
  createInMemoryVideoSegmentStore,
} from "@/server/video/segments";

import { createInMemoryAdminAuditStore } from "./audit";
import {
  createInMemoryAdminJobActionStore,
  markJobUndeliverable,
  retryVideoSegmentByAdmin,
} from "./job-actions";

const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "operator@example.com",
  role: "operator" as const,
};
const userId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const segmentId = "44444444-4444-4444-8444-444444444444";

function createRetryStores() {
  const jobStore = createInMemoryJobStore([
    {
      id: jobId,
      userId,
      status: "segment_failed",
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 1,
      lastError: "provider failed",
    },
  ]);
  const segmentStore = createInMemoryVideoSegmentStore({
    jobs: [
      {
        id: jobId,
        userId,
        status: "segment_failed",
        aspectRatio: "9:16",
      },
    ],
    segments: [
      {
        id: segmentId,
        videoJobId: jobId,
        storyboardId: "storyboard-1",
        segmentIndex: 0,
        status: "failed",
        templateId: "front_push_in",
        prompt: "retry me",
        inputAssetSnapshot: { assets: [] },
        provider: "evolink",
        model: "veo3.1-pro-beta",
        providerTaskId: "task-failed",
        providerCallLogId: "call-1",
        videoKey: null,
        costEstimate: "0",
        isTest: false,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 1,
        lastError: "provider failed",
        nextRetryAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    assets: [],
  });
  return { jobStore, segmentStore };
}

describe("admin job actions", () => {
  it("requeues a failed segment and writes audit log", async () => {
    const stores = createRetryStores();
    const auditStore = createInMemoryAdminAuditStore();

    const result = await retryVideoSegmentByAdmin({
      ...stores,
      auditStore,
      actor,
      jobId,
      segmentId,
      reason: "retry provider failure",
    });

    expect(result).toEqual({
      jobId,
      segmentId,
      status: "queued",
    });
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "queued",
      providerTaskId: null,
      lastError: null,
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segments_queued");
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "job:retry_segment",
      targetType: "video_segment",
      targetId: segmentId,
    });
  });

  it("marks a reserved job undeliverable and releases credits", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 100,
      reason: "setup",
      idempotencyKey: "grant",
    });
    await reserveCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "reserve",
      idempotencyKey: `reserve:job:${jobId}`,
      relatedJobId: jobId,
    });
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "segment_failed",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 1,
        lastError: "provider failed",
      },
    ]);
    const actionStore = createInMemoryAdminJobActionStore([
      {
        id: jobId,
        userId,
        status: "segment_failed",
        creditCost: 70,
        reservedLedgerId: "ledger-reserve",
        failureReason: null,
      },
    ]);
    const auditStore = createInMemoryAdminAuditStore();

    const result = await markJobUndeliverable({
      jobStore,
      actionStore,
      creditStore,
      auditStore,
      actor,
      jobId,
      reason: "cannot recover generation",
    });

    expect(result).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
    });
    expect(creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
      "release",
    ]);
    expect(jobStore.listJobs()[0]?.status).toBe("failed_released");
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "job:mark_undeliverable",
      targetType: "video_job",
      targetId: jobId,
    });
  });
});
