import { describe, expect, it } from "vitest";

import { grantTrialCredits, reserveCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { getVideoSpec } from "@/lib/video/specs";
import { createInMemoryFunnelEventStore } from "@/server/analytics/funnel-events";
import {
  createInMemoryJobStore,
  type JobStore,
} from "@/server/jobs/state-machine";

import {
  createInMemoryPostQaStore,
  resolvePostQaResult,
  resumePostQaResolution,
} from "./resolve";

const userId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";

async function createStores(creditCost = 130) {
  const creditStore = createInMemoryCreditLedgerStore();
  await grantTrialCredits({
    store: creditStore,
    userId,
    amount: creditCost + 50,
    reason: "test setup",
    idempotencyKey: "grant:user-1",
  });
  await reserveCredits({
    store: creditStore,
    userId,
    amount: creditCost,
    reason: "reserve test",
    idempotencyKey: `reserve:job:${jobId}`,
    relatedJobId: jobId,
  });
  const reserveLedger = creditStore
    .listLedger()
    .find((entry) => entry.type === "reserve");
  const jobStore = createInMemoryJobStore([
    {
      id: jobId,
      userId,
      status: "post_qa_running",
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 0,
      lastError: null,
    },
  ]);
  const postQaStore = createInMemoryPostQaStore({
    jobs: [
      {
        id: jobId,
        userId,
        status: "post_qa_running",
        creditCost,
        reservedLedgerId: reserveLedger?.id ?? null,
        isTest: true,
      },
    ],
  });

  return { creditStore, jobStore, postQaStore };
}

describe("resolvePostQaResult", () => {
  it.each([24, 32] as const)(
    "uses the configured credit lifecycle for %i-second jobs",
    async (durationSeconds) => {
      const creditCost = getVideoSpec(durationSeconds).creditCost;
      const passedStores = await createStores(creditCost);
      await resolvePostQaResult({
        ...passedStores,
        jobId,
        status: "passed",
        mode: "standard",
        frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
        resultJson: { passed: true },
      });

      expect(
        passedStores.creditStore.listLedger().map(({ type, amount }) => ({
          type,
          amount,
        })),
      ).toEqual([
        { type: "trial_grant", amount: creditCost + 50 },
        { type: "reserve", amount: creditCost },
        { type: "capture", amount: creditCost },
      ]);

      const failedStores = await createStores(creditCost);
      await resolvePostQaResult({
        ...failedStores,
        jobId,
        status: "failed",
        mode: "standard",
        frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
        resultJson: { passed: false },
        failureCategory: "garment_mismatch",
      });

      expect(
        failedStores.creditStore.listLedger().map(({ type, amount }) => ({
          type,
          amount,
        })),
      ).toEqual([
        { type: "trial_grant", amount: creditCost + 50 },
        { type: "reserve", amount: creditCost },
        { type: "release", amount: creditCost },
      ]);
    },
  );

  it("captures reserved credits and marks a job deliverable when QA passes", async () => {
    const stores = await createStores();
    const funnelStore = createInMemoryFunnelEventStore();

    const result = await resolvePostQaResult({
      ...stores,
      jobId,
      status: "passed",
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: true },
      funnelEventStore: funnelStore,
    });

    expect(result).toEqual({
      jobId,
      status: "deliverable",
      ledgerType: "capture",
    });
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
      "capture",
    ]);
    expect(stores.jobStore.listJobs()[0]?.status).toBe("deliverable");
    expect(stores.postQaStore.listResults()[0]).toMatchObject({
      videoJobId: jobId,
      status: "passed",
      mode: "standard",
      isTest: true,
    });
    expect(funnelStore.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "generation_deliverable",
        source: "server",
        userId,
        metadata: expect.objectContaining({
          jobId,
          status: "deliverable",
        }),
      }),
    ]);
    expect(JSON.stringify(funnelStore.listEvents())).not.toContain(
      "jobs/job-1/qa/frames/0.jpg",
    );
  });

  it("does not capture credits twice when a passed QA resolve is replayed", async () => {
    const stores = await createStores();

    await resolvePostQaResult({
      ...stores,
      jobId,
      status: "passed",
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: true },
    });
    await resolvePostQaResult({
      ...stores,
      jobId,
      status: "passed",
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: true },
    });

    expect(
      stores.creditStore
        .listLedger()
        .filter((entry) => entry.type === "capture"),
    ).toHaveLength(1);
  });

  it.each([
    {
      qaStatus: "passed" as const,
      intermediateStatus: "post_qa_passed" as const,
      terminalStatus: "deliverable" as const,
      ledgerType: "capture" as const,
      failureCategory: undefined,
    },
    {
      qaStatus: "failed" as const,
      intermediateStatus: "post_qa_failed" as const,
      terminalStatus: "failed_released" as const,
      ledgerType: "release" as const,
      failureCategory: "garment_mismatch",
    },
  ])(
    "resumes $intermediateStatus after ledger settlement without rerunning QA",
    async ({
      qaStatus,
      intermediateStatus,
      terminalStatus,
      ledgerType,
      failureCategory,
    }) => {
      const stores = await createStores();
      let failTerminalWrite = true;
      const flakyJobStore: JobStore = {
        findJob: (id) => stores.jobStore.findJob(id),
        createStateEvent: (input) => stores.jobStore.createStateEvent(input),
        updateJobStatus: async (id, changes) => {
          if (changes.status === terminalStatus && failTerminalWrite) {
            failTerminalWrite = false;
            throw new Error("terminal state write failed");
          }
          return stores.jobStore.updateJobStatus(id, changes);
        },
      };

      await expect(
        resolvePostQaResult({
          ...stores,
          jobStore: flakyJobStore,
          jobId,
          status: qaStatus,
          mode: "strict",
          frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
          resultJson: { passed: qaStatus === "passed" },
          ...(failureCategory ? { failureCategory } : {}),
        }),
      ).rejects.toThrow("terminal state write failed");

      expect(stores.jobStore.listJobs()[0]?.status).toBe(intermediateStatus);
      expect(
        stores.creditStore.listLedger().filter((entry) => entry.type === ledgerType),
      ).toHaveLength(1);
      expect(stores.postQaStore.listResults()).toHaveLength(1);

      const resumed = await resumePostQaResolution({
        ...stores,
        jobId,
      });

      expect(resumed).toMatchObject({ jobId, status: terminalStatus });
      expect(stores.jobStore.listJobs()[0]?.status).toBe(terminalStatus);
      expect(
        stores.creditStore.listLedger().filter((entry) => entry.type === ledgerType),
      ).toHaveLength(1);
      expect(stores.postQaStore.listResults()).toHaveLength(1);
    },
  );

  it("does not release an unsettled provider-retry reservation during recovery", async () => {
    const stores = await createStores();
    await stores.jobStore.updateJobStatus(jobId, { status: "post_qa_failed" });
    await stores.postQaStore.createResult({
      videoJobId: jobId,
      status: "failed",
      mode: "strict",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: false, retryScopeId: "active-reserve" },
      failureCategory: "provider_unavailable",
    });

    await expect(
      resumePostQaResolution({ ...stores, jobId }),
    ).rejects.toThrow("Post-QA ledger settlement is incomplete.");

    expect(stores.jobStore.listJobs()[0]?.status).toBe("post_qa_failed");
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
    ]);
    expect(stores.postQaStore.listResults()).toHaveLength(1);
  });

  it("releases reserved credits when QA fails", async () => {
    const stores = await createStores();
    const funnelStore = createInMemoryFunnelEventStore();

    const result = await resolvePostQaResult({
      ...stores,
      jobId,
      status: "failed",
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: false },
      failureCategory: "garment_mismatch",
      funnelEventStore: funnelStore,
    });

    expect(result).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
    });
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
      "release",
    ]);
    expect(stores.jobStore.listJobs()[0]?.status).toBe("failed_released");
    expect(funnelStore.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "generation_failed",
        metadata: expect.objectContaining({
          jobId,
          status: "failed_released",
          reasonCategory: "garment_mismatch",
        }),
      }),
    ]);
  });

  it("resolves each successive reservation for the same job independently", async () => {
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 300,
      reason: "test setup",
      idempotencyKey: "grant:successive-reservations",
    });

    const resolveFailedReservation = async (
      reserveLedgerId: string,
      attempt: number,
    ) => {
      await resolvePostQaResult({
        creditStore,
        jobStore: createInMemoryJobStore([
          {
            id: jobId,
            userId,
            status: "post_qa_running",
            lockedBy: null,
            lockedUntil: null,
            attemptCount: attempt,
            lastError: null,
          },
        ]),
        postQaStore: createInMemoryPostQaStore({
          jobs: [
            {
              id: jobId,
              userId,
              status: "post_qa_running",
              creditCost: 100,
              reservedLedgerId: reserveLedgerId,
            },
          ],
        }),
        jobId,
        status: "failed",
        mode: "strict",
        frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
        resultJson: { passed: false },
        failureCategory: "garment_mismatch",
      });
    };

    const firstReserve = await reserveCredits({
      store: creditStore,
      userId,
      amount: 100,
      reason: "first reserve",
      idempotencyKey: `reserve:job:${jobId}:attempt:1`,
      relatedJobId: jobId,
    });
    await resolveFailedReservation(firstReserve.ledger.id, 1);

    const secondReserve = await reserveCredits({
      store: creditStore,
      userId,
      amount: 100,
      reason: "second reserve",
      idempotencyKey: `reserve:job:${jobId}:attempt:2`,
      relatedJobId: jobId,
    });
    await resolveFailedReservation(secondReserve.ledger.id, 2);

    const releases = creditStore
      .listLedger()
      .filter((entry) => entry.type === "release");
    expect(releases).toHaveLength(2);
    expect(releases.map((entry) => entry.idempotencyKey)).toEqual([
      `release:job:${jobId}:reserve:${firstReserve.ledger.id}`,
      `release:job:${jobId}:reserve:${secondReserve.ledger.id}`,
    ]);
    expect(releases[1]?.reservedAfter).toBe(0);
  });

  it("rejects an active paid resolution without a reservation before mutations", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "post_qa_running",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 1,
        lastError: null,
      },
    ]);
    const postQaStore = createInMemoryPostQaStore({
      jobs: [
        {
          id: jobId,
          userId,
          status: "post_qa_running",
          creditCost: 100,
          reservedLedgerId: null,
        },
      ],
    });

    await expect(
      resolvePostQaResult({
        creditStore: createInMemoryCreditLedgerStore(),
        jobStore,
        postQaStore,
        jobId,
        status: "passed",
        mode: "strict",
        frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
        resultJson: { passed: true },
      }),
    ).rejects.toThrow("Paid post-QA job has no reserved ledger.");

    expect(jobStore.listJobs()[0]?.status).toBe("post_qa_running");
    expect(postQaStore.listResults()).toHaveLength(0);
  });

  it("does not capture or release credits for zero-cost jobs", async () => {
    const creditStore = createInMemoryCreditLedgerStore();

    const passed = await resolvePostQaResult({
      creditStore,
      jobStore: createInMemoryJobStore([
        {
          id: jobId,
          userId,
          status: "post_qa_running",
          lockedBy: null,
          lockedUntil: null,
          attemptCount: 0,
          lastError: null,
        },
      ]),
      postQaStore: createInMemoryPostQaStore({
        jobs: [
          {
            id: jobId,
            userId,
            status: "post_qa_running",
            creditCost: 0,
            reservedLedgerId: null,
          },
        ],
      }),
      jobId,
      status: "passed",
      mode: "lite",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: true },
    });

    expect(passed).toEqual({
      jobId,
      status: "deliverable",
      ledgerType: null,
    });
    expect(creditStore.listLedger()).toHaveLength(0);

    const failed = await resolvePostQaResult({
      creditStore,
      jobStore: createInMemoryJobStore([
        {
          id: jobId,
          userId,
          status: "post_qa_running",
          lockedBy: null,
          lockedUntil: null,
          attemptCount: 0,
          lastError: null,
        },
      ]),
      postQaStore: createInMemoryPostQaStore({
        jobs: [
          {
            id: jobId,
            userId,
            status: "post_qa_running",
            creditCost: 0,
            reservedLedgerId: null,
          },
        ],
      }),
      jobId,
      status: "failed",
      mode: "lite",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: false },
      failureCategory: "garment_mismatch",
    });

    expect(failed).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: null,
    });
    expect(creditStore.listLedger()).toHaveLength(0);
  });
});
