import { describe, expect, it } from "vitest";

import {
  captureReservedCredits,
  grantTrialCredits,
  releaseReservedCredits,
  reserveCredits,
} from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";
import {
  createInMemoryVideoSegmentStore,
} from "@/server/video/segments";

import { createInMemoryAdminAuditStore } from "./audit";
import {
  createInMemoryAdminJobActionStore,
  createInMemoryAdminPostQaReopenStore,
  reopenPostQaByAdmin,
  releaseJobCreditsByAdmin,
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
const stitchJobId = "55555555-5555-4555-8555-555555555555";

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
        creditCost: 70,
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
        model: "veo3.1-fast-beta",
        providerTaskId: "task-failed",
        providerCallLogId: "call-1",
        videoKey: null,
        costEstimate: "0",
        generationProfile: "paid_720p_audio",
        resolution: "720p",
        audioEnabled: true,
        watermarkEnabled: false,
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
  it("rejects retrying segments when reason is missing or too short", async () => {
    const stores = createRetryStores();

    await expect(
      retryVideoSegmentByAdmin({
        ...stores,
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        jobId,
        segmentId,
        reason: "   ",
      }),
    ).rejects.toThrow("Admin action reason must be at least 6 characters.");

    await expect(
      retryVideoSegmentByAdmin({
        ...stores,
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        jobId,
        segmentId,
        reason: "short",
      }),
    ).rejects.toThrow("Admin action reason must be at least 6 characters.");
  });

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

  it("clears stale job errors when requeueing a failed segment", async () => {
    const stores = createRetryStores();
    const auditStore = createInMemoryAdminAuditStore();
    await stores.jobStore.updateJobStatus(jobId, {
      status: "segment_failed",
      lastError: "No active model route for video_generation in development.",
      failureReason: "No active model route for video_generation in development.",
    });

    await retryVideoSegmentByAdmin({
      ...stores,
      auditStore,
      actor,
      jobId,
      segmentId,
      reason: "retry after route configuration",
    });

    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "segments_queued",
      lastError: null,
      failureReason: null,
    });
  });

  it("releases reserved credits idempotently and audits every admin invocation", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 100,
      reason: "setup",
      idempotencyKey: "grant:release",
    });
    const reserve = await reserveCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "reserve",
      idempotencyKey: `reserve:job:${jobId}:release-action`,
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
        reservedLedgerId: reserve.ledger.id,
        failureReason: "provider failed",
      },
    ], [
      { id: reserve.ledger.id, type: "reserve", relatedJobId: jobId },
    ]);
    const auditStore = createInMemoryAdminAuditStore();

    const first = await releaseJobCreditsByAdmin({
      jobStore,
      actionStore,
      creditStore,
      auditStore,
      actor,
      jobId,
      reason: "release stuck failed job",
    });
    const second = await releaseJobCreditsByAdmin({
      jobStore,
      actionStore,
      creditStore,
      auditStore,
      actor,
      jobId,
      reason: "release stuck failed job",
    });

    expect(first).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
      idempotent: false,
    });
    expect(second).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
      idempotent: true,
    });
    expect(creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
      "release",
    ]);
    expect(jobStore.listJobs()[0]?.status).toBe("failed_released");
    expect(auditStore.listAuditLogs()).toHaveLength(2);
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "job:release_credits",
      targetType: "video_job",
      targetId: jobId,
      afterSnapshot: expect.objectContaining({
        status: "failed_released",
      }),
    });
  });

  it("rejects admin release for delivered, captured, or unreserved jobs", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    const auditStore = createInMemoryAdminAuditStore();

    await expect(
      releaseJobCreditsByAdmin({
        jobStore: createInMemoryJobStore([
          {
            id: jobId,
            userId,
            status: "deliverable",
            lockedBy: null,
            lockedUntil: null,
            attemptCount: 1,
            lastError: null,
          },
        ]),
        actionStore: createInMemoryAdminJobActionStore([
          {
            id: jobId,
            userId,
            status: "deliverable",
            creditCost: 70,
            reservedLedgerId: "ledger-reserve",
            failureReason: null,
          },
        ]),
        creditStore,
        auditStore,
        actor,
        jobId,
        reason: "release not allowed",
      }),
    ).rejects.toThrow("Video job credits cannot be released in this state.");

    await expect(
      releaseJobCreditsByAdmin({
        jobStore: createInMemoryJobStore([
          {
            id: jobId,
            userId,
            status: "segment_failed",
            lockedBy: null,
            lockedUntil: null,
            attemptCount: 1,
            lastError: "provider failed",
          },
        ]),
        actionStore: createInMemoryAdminJobActionStore([
          {
            id: jobId,
            userId,
            status: "segment_failed",
            creditCost: 70,
            reservedLedgerId: null,
            failureReason: "provider failed",
          },
        ]),
        creditStore,
        auditStore,
        actor,
        jobId,
        reason: "release not allowed",
      }),
    ).rejects.toThrow("Video job has no reserved ledger to release.");

    const capturedCreditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: capturedCreditStore,
      userId,
      amount: 100,
      reason: "setup",
      idempotencyKey: "grant:captured",
    });
    const reserve = await reserveCredits({
      store: capturedCreditStore,
      userId,
      amount: 70,
      reason: "reserve",
      idempotencyKey: `reserve:job:${jobId}:captured`,
      relatedJobId: jobId,
    });
    await captureReservedCredits({
      store: capturedCreditStore,
      userId,
      amount: 70,
      reason: "capture",
      idempotencyKey: `capture:job:${jobId}:captured`,
      relatedJobId: jobId,
    });

    await expect(
      releaseJobCreditsByAdmin({
        jobStore: createInMemoryJobStore([
          {
            id: jobId,
            userId,
            status: "segment_failed",
            lockedBy: null,
            lockedUntil: null,
            attemptCount: 1,
            lastError: "provider failed",
          },
        ]),
        actionStore: createInMemoryAdminJobActionStore([
          {
            id: jobId,
            userId,
            status: "segment_failed",
            creditCost: 70,
            reservedLedgerId: reserve.ledger.id,
            failureReason: "provider failed",
          },
        ], [
          { id: reserve.ledger.id, type: "reserve", relatedJobId: jobId },
          { id: "ledger-capture", type: "capture", relatedJobId: jobId, metadata: { reservedLedgerId: reserve.ledger.id } },
        ]),
        creditStore: capturedCreditStore,
        auditStore,
        actor,
        jobId,
        reason: "release not allowed",
      }),
    ).rejects.toThrow("Video job reserved credits are already resolved.");
  });

  it("releases the current reservation after an earlier reservation was released", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: creditStore, userId, amount: 140, reason: "setup", idempotencyKey: "grant:admin-release-current" });
    const firstReserve = await reserveCredits({ store: creditStore, userId, amount: 70, reason: "first reserve", idempotencyKey: `reserve:job:${jobId}:first`, relatedJobId: jobId });
    await releaseReservedCredits({ store: creditStore, userId, amount: 70, reason: "first release", idempotencyKey: `release:job:${jobId}:reserve:${firstReserve.ledger.id}`, relatedJobId: jobId, metadata: { reservedLedgerId: firstReserve.ledger.id } });
    const currentReserve = await reserveCredits({ store: creditStore, userId, amount: 70, reason: "current reserve", idempotencyKey: `reserve:job:${jobId}:second`, relatedJobId: jobId });
    const ledgerRecords = creditStore.listLedger().map((entry) => ({
      id: entry.id,
      type: entry.type,
      relatedJobId: entry.relatedJobId,
      metadata: entry.metadata,
    }));

    const result = await releaseJobCreditsByAdmin({
      jobStore: createInMemoryJobStore([{ id: jobId, userId, status: "post_qa_failed", lockedBy: null, lockedUntil: null, attemptCount: 2, lastError: "qa failed" }]),
      actionStore: createInMemoryAdminJobActionStore([{ id: jobId, userId, status: "post_qa_failed", creditCost: 70, reservedLedgerId: currentReserve.ledger.id, failureReason: "qa failed" }], ledgerRecords),
      creditStore,
      auditStore: createInMemoryAdminAuditStore(),
      actor,
      jobId,
      reason: "release current retry reservation",
    });

    expect(result).toMatchObject({ ledgerType: "release", idempotent: false });
    const releases = creditStore.listLedger().filter((entry) => entry.type === "release");
    expect(releases).toHaveLength(2);
    expect(releases[1]?.metadata).toMatchObject({ reservedLedgerId: currentReserve.ledger.id });
    expect(releases[1]?.reservedAfter).toBe(0);
  });

  it("atomically reserves credits when reopening a released post-QA job", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 100,
      reason: "setup",
      idempotencyKey: "grant:post-qa-reopen",
    });
    const oldReserve = await reserveCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "old reserve",
      idempotencyKey: `reserve:job:${jobId}:old`,
      relatedJobId: jobId,
    });
    await releaseReservedCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "old release",
      idempotencyKey: `release:job:${jobId}:reserve:${oldReserve.ledger.id}`,
      relatedJobId: jobId,
      metadata: { reservedLedgerId: oldReserve.ledger.id },
    });
    const postQaStore = createInMemoryAdminPostQaReopenStore({
      jobs: [
        {
          id: jobId,
          userId,
          status: "failed_released",
          creditCost: 70,
          reservedLedgerId: oldReserve.ledger.id,
          failureReason: "Post-QA schema error",
        },
      ],
      stitchJobs: [
        {
          id: stitchJobId,
          videoJobId: jobId,
          status: "succeeded",
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: "jobs/job-1/covers/cover.webp",
          frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
        },
      ],
      creditStore,
    });
    const auditStore = createInMemoryAdminAuditStore();

    const first = await reopenPostQaByAdmin({
      postQaStore,
      auditStore,
      actor,
      jobId,
      reason: "retry with fixed Post-QA schema",
    });
    const second = await reopenPostQaByAdmin({
      postQaStore,
      auditStore,
      actor,
      jobId,
      reason: "retry with fixed Post-QA schema",
    });

    const newReserve = creditStore
      .listLedger()
      .filter((entry) => entry.type === "reserve")[1];
    expect(first).toEqual({
      jobId,
      status: "post_qa_queued",
      stitchJobId,
      frameCount: 1,
      reservedLedgerId: newReserve?.id,
      idempotent: false,
    });
    expect(second).toEqual({ ...first, idempotent: true });
    expect(postQaStore.listJobs()[0]).toMatchObject({
      status: "post_qa_queued",
      reservedLedgerId: newReserve?.id,
      failureReason: null,
    });
    expect(creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
      "release",
      "reserve",
    ]);
    expect(newReserve?.reservedAfter).toBe(70);
    expect(auditStore.listAuditLogs()).toHaveLength(2);
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "job:reopen_post_qa",
      targetType: "video_job",
      targetId: jobId,
    });
  });

  it("repairs status and audit when a release ledger already exists", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "setup",
      idempotencyKey: "grant:release-recovery",
    });
    const reserve = await reserveCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "reserve",
      idempotencyKey: `reserve:job:${jobId}:release-recovery`,
      relatedJobId: jobId,
    });
    await releaseReservedCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "release before state update",
      idempotencyKey: `admin_release:job:${jobId}:reserve:${reserve.ledger.id}`,
      relatedJobId: jobId,
      metadata: { reservedLedgerId: reserve.ledger.id },
    });
    const ledgerRecords = creditStore.listLedger().map((entry) => ({
      id: entry.id,
      type: entry.type,
      relatedJobId: entry.relatedJobId,
      metadata: entry.metadata,
    }));
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "post_qa_failed",
        lockedBy: "post-qa-worker",
        lockedUntil: new Date("2026-08-05T12:00:00.000Z"),
        attemptCount: 2,
        lastError: "provider failed",
      },
    ]);
    const auditStore = createInMemoryAdminAuditStore();

    const result = await releaseJobCreditsByAdmin({
      jobStore,
      actionStore: createInMemoryAdminJobActionStore(
        [
          {
            id: jobId,
            userId,
            status: "post_qa_failed",
            creditCost: 70,
            reservedLedgerId: reserve.ledger.id,
            failureReason: "provider failed",
          },
        ],
        ledgerRecords,
      ),
      creditStore,
      auditStore,
      actor,
      jobId,
      reason: "recover interrupted admin release",
    });

    expect(result).toMatchObject({ status: "failed_released", idempotent: true });
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "failed_released",
      lockedBy: null,
      lockedUntil: null,
    });
    expect(auditStore.listAuditLogs()).toHaveLength(1);
    expect(creditStore.listLedger().filter((entry) => entry.type === "release")).toHaveLength(1);
  });

  it("rejects reopening the transient post_qa_failed state", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: creditStore, userId, amount: 100, reason: "setup", idempotencyKey: "grant:post-qa-unresolved" });
    const reserve = await reserveCredits({ store: creditStore, userId, amount: 70, reason: "active reserve", idempotencyKey: `reserve:job:${jobId}:active`, relatedJobId: jobId });
    const postQaStore = createInMemoryAdminPostQaReopenStore({
      jobs: [{ id: jobId, userId, status: "post_qa_failed", creditCost: 70, reservedLedgerId: reserve.ledger.id, failureReason: "provider_schema_error" }],
      stitchJobs: [{ id: stitchJobId, videoJobId: jobId, status: "succeeded", finalVideoKey: "jobs/job-1/stitched/final.mp4", coverKey: null, frameKeys: ["jobs/job-1/qa/frames/0.jpg"] }],
      creditStore,
    });

    await expect(reopenPostQaByAdmin({ postQaStore, auditStore: createInMemoryAdminAuditStore(), actor, jobId, reason: "retry after schema fix" })).rejects.toThrow("Video job is not settled after Post-QA failure.");
    expect(creditStore.listLedger().filter((entry) => entry.type === "reserve")).toHaveLength(1);
    expect(postQaStore.listJobs()[0]?.status).toBe("post_qa_failed");
  });

  it("can recover the audit log after an idempotent reopen replay", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: creditStore, userId, amount: 70, reason: "setup", idempotencyKey: "grant:post-qa-audit-recovery" });
    const oldReserve = await reserveCredits({ store: creditStore, userId, amount: 70, reason: "old reserve", idempotencyKey: `reserve:job:${jobId}:audit:old`, relatedJobId: jobId });
    await releaseReservedCredits({ store: creditStore, userId, amount: 70, reason: "old release", idempotencyKey: `release:job:${jobId}:reserve:${oldReserve.ledger.id}`, relatedJobId: jobId, metadata: { reservedLedgerId: oldReserve.ledger.id } });
    const postQaStore = createInMemoryAdminPostQaReopenStore({
      jobs: [{ id: jobId, userId, status: "failed_released", creditCost: 70, reservedLedgerId: oldReserve.ledger.id, failureReason: "provider_unavailable" }],
      stitchJobs: [{ id: stitchJobId, videoJobId: jobId, status: "succeeded", finalVideoKey: "jobs/job-1/stitched/final.mp4", coverKey: null, frameKeys: ["jobs/job-1/qa/frames/0.jpg"] }],
      creditStore,
    });

    await expect(reopenPostQaByAdmin({
      postQaStore,
      auditStore: { createAuditLog: async () => { throw new Error("audit unavailable"); } },
      actor,
      jobId,
      reason: "retry after provider recovery",
    })).rejects.toThrow("audit unavailable");

    const recoveredAuditStore = createInMemoryAdminAuditStore();
    const replay = await reopenPostQaByAdmin({ postQaStore, auditStore: recoveredAuditStore, actor, jobId, reason: "retry after provider recovery" });
    expect(replay.idempotent).toBe(true);
    expect(recoveredAuditStore.listAuditLogs()).toHaveLength(1);
    expect(creditStore.listLedger().filter((entry) => entry.type === "reserve")).toHaveLength(2);
  });

  it("leaves a released job unchanged when reopen credits are insufficient", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: creditStore, userId, amount: 70, reason: "setup", idempotencyKey: "grant:post-qa-insufficient" });
    const oldReserve = await reserveCredits({ store: creditStore, userId, amount: 70, reason: "old reserve", idempotencyKey: `reserve:job:${jobId}:insufficient:old`, relatedJobId: jobId });
    await releaseReservedCredits({ store: creditStore, userId, amount: 70, reason: "old release", idempotencyKey: `release:job:${jobId}:reserve:${oldReserve.ledger.id}`, relatedJobId: jobId, metadata: { reservedLedgerId: oldReserve.ledger.id } });
    await reserveCredits({ store: creditStore, userId, amount: 70, reason: "other job", idempotencyKey: "reserve:other-job", relatedJobId: "66666666-6666-4666-8666-666666666666" });
    const postQaStore = createInMemoryAdminPostQaReopenStore({
      jobs: [{ id: jobId, userId, status: "failed_released", creditCost: 70, reservedLedgerId: oldReserve.ledger.id, failureReason: "provider_unavailable" }],
      stitchJobs: [{ id: stitchJobId, videoJobId: jobId, status: "succeeded", finalVideoKey: "jobs/job-1/stitched/final.mp4", coverKey: null, frameKeys: ["jobs/job-1/qa/frames/0.jpg"] }],
      creditStore,
    });

    await expect(reopenPostQaByAdmin({ postQaStore, auditStore: createInMemoryAdminAuditStore(), actor, jobId, reason: "retry after provider recovery" })).rejects.toThrow("Insufficient available credits.");

    expect(postQaStore.listJobs()[0]).toMatchObject({ status: "failed_released", reservedLedgerId: oldReserve.ledger.id });
    expect(creditStore.listLedger().filter((entry) => entry.type === "reserve")).toHaveLength(2);
  });

  it("rejects reopening post qa when reason is too short", async () => {
    await expect(
      reopenPostQaByAdmin({
        postQaStore: createInMemoryAdminPostQaReopenStore({ jobs: [], stitchJobs: [], creditStore: createInMemoryCreditLedgerStore() }),
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        jobId,
        reason: "bad",
      }),
    ).rejects.toThrow("Admin action reason must be at least 6 characters.");
  });

  it("rejects post-QA reopen when no successful stitched output exists", async () => {
    await expect(
      reopenPostQaByAdmin({
        postQaStore: createInMemoryAdminPostQaReopenStore({
          jobs: [{ id: jobId, userId, status: "failed_released", creditCost: 70, reservedLedgerId: null, failureReason: "Post-QA schema error" }],
          stitchJobs: [],
          creditStore: createInMemoryCreditLedgerStore(),
        }),
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        jobId,
        reason: "retry with fixed Post-QA schema",
      }),
    ).rejects.toThrow("Successful stitch output is required to reopen Post-QA.");
  });
});
