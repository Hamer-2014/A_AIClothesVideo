import { describe, expect, it } from "vitest";

import { grantTrialCredits, reserveCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import { createInMemoryPostQaStore, resolvePostQaResult } from "./resolve";

const userId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";

async function createStores() {
  const creditStore = createInMemoryCreditLedgerStore();
  await grantTrialCredits({
    store: creditStore,
    userId,
    amount: 200,
    reason: "test setup",
    idempotencyKey: "grant:user-1",
  });
  await reserveCredits({
    store: creditStore,
    userId,
    amount: 130,
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
        creditCost: 130,
        reservedLedgerId: reserveLedger?.id ?? null,
      },
    ],
  });

  return { creditStore, jobStore, postQaStore };
}

describe("resolvePostQaResult", () => {
  it("captures reserved credits and marks a job deliverable when QA passes", async () => {
    const stores = await createStores();

    const result = await resolvePostQaResult({
      ...stores,
      jobId,
      status: "passed",
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: true },
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
    });
  });

  it("releases reserved credits when QA fails", async () => {
    const stores = await createStores();

    const result = await resolvePostQaResult({
      ...stores,
      jobId,
      status: "failed",
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      resultJson: { passed: false },
      failureCategory: "garment_mismatch",
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
  });
});
