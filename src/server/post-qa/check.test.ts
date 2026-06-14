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
      userVisibleStatus: "failed",
      failureReason: "provider_unavailable",
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
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "failed_released",
      userVisibleStatus: "failed",
      failureReason: "missing_frames",
    });
    expect(stores.providerCallLogStore.listCallLogs()).toHaveLength(0);
  });

  it("stores the QA failure category on the job when visual quality is rejected", async () => {
    const stores = await createStores();

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "lite",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      createSignedUrl: async ({ key }) => `https://r2.example/${key}`,
      visionProvider: async () => ({
        provider: "openai",
        model: "gpt-vision",
        qaJson: {
          passed: false,
          failure_category: "Quality/visual artifacts",
          risk_flags: ["dark frame"],
          checks: [{ name: "Visual clarity", passed: false }],
        },
        raw: { id: "resp-qa-failed" },
      }),
    });

    expect(result).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
    });
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "failed_released",
      userVisibleStatus: "failed",
      failureReason: "Quality/visual artifacts",
      lastError: "Quality/visual artifacts",
    });
  });

  it("does not fail childrenswear QA when minor_present is the only concern", async () => {
    const stores = await createStores();

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      createSignedUrl: async ({ key }) => `https://r2.example/${key}`,
      visionProvider: async () => ({
        provider: "openai",
        model: "gpt-vision",
        qaJson: {
          passed: false,
          failure_category: "Brand policy uncertainty",
          risk_flags: ["minor_present"],
          checks: [
            {
              name: "safety",
              passed: false,
              notes: "Child model present; brand policy may vary.",
            },
          ],
          summary: "Child model appears in a childrenswear product context.",
        },
        raw: { id: "resp-qa-minor-present" },
      }),
    });

    expect(result).toEqual({
      jobId,
      status: "deliverable",
      ledgerType: "capture",
    });
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "deliverable",
      failureReason: null,
    });
    expect(stores.postQaStore.listResults()[0]).toMatchObject({
      status: "passed",
      failureCategory: null,
    });
  });

  it("does not fail childrenswear QA for soft brand suitability concerns in ordinary scenes", async () => {
    const stores = await createStores();

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      createSignedUrl: async ({ key }) => `https://r2.example/${key}`,
      visionProvider: async () => ({
        provider: "openai",
        model: "gpt-vision",
        qaJson: {
          passed: false,
          failure_category: "policy_or_brand_suitability",
          risk_flags: ["child_model", "outdoor_street_scene", "slight_motion_blur"],
          checks: [
            {
              name: "Garment consistency across frames",
              passed: true,
              notes: "Dress remains visually consistent in color and silhouette.",
            },
            {
              name: "Frame clarity and quality",
              passed: true,
              notes: "Frames are clear enough to assess the garment.",
            },
            {
              name: "Product marketing suitability",
              passed: false,
              notes:
                "Child model and outdoor street setting may limit broad product-ad suitability depending on brand policy.",
            },
            {
              name: "Safety and appropriateness",
              passed: true,
              notes: "No explicit safety issues observed.",
            },
          ],
          summary:
            "Garment appears consistent and well-presented, but brand policy may vary for child model in an outdoor scene.",
        },
        raw: { id: "resp-qa-soft-brand-suitability" },
      }),
    });

    expect(result).toEqual({
      jobId,
      status: "deliverable",
      ledgerType: "capture",
    });
    expect(stores.postQaStore.listResults()[0]).toMatchObject({
      status: "passed",
      failureCategory: null,
    });
  });

  it("still fails childrenswear QA when blurry quality issues are present", async () => {
    const stores = await createStores();

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      createSignedUrl: async ({ key }) => `https://r2.example/${key}`,
      visionProvider: async () => ({
        provider: "openai",
        model: "gpt-vision",
        qaJson: {
          passed: false,
          failure_category: "Quality/visual artifacts",
          risk_flags: ["minor_present", "slightly_blurry"],
          checks: [
            {
              name: "visual_clarity",
              passed: false,
              notes: "Product is blurry enough to limit marketing readiness.",
            },
          ],
          summary: "Child model appears, but the product is blurry.",
        },
        raw: { id: "resp-qa-blurry" },
      }),
    });

    expect(result).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
    });
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "failed_released",
      failureReason: "Quality/visual artifacts",
    });
  });

  it("still fails childrenswear QA when safety concerns are present", async () => {
    const stores = await createStores();

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      createSignedUrl: async ({ key }) => `https://r2.example/${key}`,
      visionProvider: async () => ({
        provider: "openai",
        model: "gpt-vision",
        qaJson: {
          passed: false,
          failure_category: "unsafe_child_content",
          risk_flags: ["child_model", "sexualized_child_imagery"],
          checks: [
            {
              name: "safety",
              passed: false,
              notes: "Unsafe child presentation is present.",
            },
          ],
          summary: "The childrenswear video contains unsafe child content.",
        },
        raw: { id: "resp-qa-unsafe-child" },
      }),
    });

    expect(result).toEqual({
      jobId,
      status: "failed_released",
      ledgerType: "release",
    });
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "failed_released",
      failureReason: "unsafe_child_content",
    });
  });
});
