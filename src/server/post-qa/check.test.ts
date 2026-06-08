import { describe, expect, it } from "vitest";

import { grantTrialCredits, reserveCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import { runPostQaCheck } from "./check";
import { createInMemoryPostQaStore } from "./resolve";

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
      status: "post_qa_queued",
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
        status: "post_qa_queued",
        creditCost: 130,
        reservedLedgerId: reserveLedger?.id ?? null,
      },
    ],
  });
  const providerCallLogStore = createInMemoryProviderCallLogStore();

  return { creditStore, jobStore, postQaStore, providerCallLogStore };
}

describe("runPostQaCheck", () => {
  it("checks stitched frames with vision and captures credits when QA passes", async () => {
    const stores = await createStores();

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      createSignedUrl: async ({ key }) => `https://r2.example/${key}`,
      visionProvider: async (input) => ({
        provider: "openai",
        model: "gpt-vision",
        qaJson: {
          passed: true,
          failure_category: null,
          risk_flags: [],
          checks: [{ name: "garment_consistency", passed: true }],
          mode: input.mode,
        },
        raw: { id: "resp-1" },
      }),
    });

    expect(result).toEqual({
      jobId,
      status: "deliverable",
      ledgerType: "capture",
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("deliverable");
    expect(stores.providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "openai",
      model: "gpt-vision",
      purpose: "post_qa",
      status: "succeeded",
    });
  });

  it("fails closed and releases credits when the vision provider errors", async () => {
    const stores = await createStores();

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "strict",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      createSignedUrl: async ({ key }) => `https://r2.example/${key}`,
      visionProvider: async () => {
        throw new Error("vision unavailable");
      },
    });

    expect(result).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
    });
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "failed_released",
    });
    expect(stores.providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "vision",
      model: "unknown",
      purpose: "post_qa",
      status: "failed",
      errorCode: "post_qa_provider_error",
      errorMessage: "vision unavailable",
    });
  });

  it("fails closed when stitched output has no QA frames", async () => {
    const stores = await createStores();

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "standard",
      frameKeys: [],
      visionProvider: async () => {
        throw new Error("must not call provider");
      },
    });

    expect(result).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("failed_released");
    expect(stores.providerCallLogStore.listCallLogs()).toHaveLength(0);
  });
});
