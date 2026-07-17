import { describe, expect, it } from "vitest";

import { grantTrialCredits, reserveCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";
import type { VideoSegmentRecord } from "@/server/storyboard/confirm";
import { createInMemoryVideoSegmentStore } from "@/server/video/segments";

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

function createFiveSegmentStore() {
  const now = new Date("2026-07-11T00:00:00.000Z");
  const segments: VideoSegmentRecord[] = Array.from(
    { length: 5 },
    (_, segmentIndex) => ({
      id: `00000000-0000-4000-8000-00000000000${segmentIndex}`,
      videoJobId: jobId,
      storyboardId: "11111111-1111-4111-8111-111111111111",
      segmentIndex,
      status: "succeeded",
      templateId: `template-${segmentIndex}`,
      prompt: `Segment ${segmentIndex}`,
      inputAssetSnapshot: {},
      provider: "apimart",
      model: "pixverse-v6",
      providerTaskId: `task-${segmentIndex}`,
      providerCallLogId: `call-${segmentIndex}`,
      videoKey: `jobs/${jobId}/segments/${segmentIndex}.mp4`,
      costEstimate: "1.00",
      generationProfile: "paid_720p_audio",
      resolution: "720p",
      audioEnabled: true,
      watermarkEnabled: false,
      isTest: true,
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 1,
      lastError: null,
      nextRetryAt: null,
      createdAt: now,
      updatedAt: now,
    }),
  );
  return createInMemoryVideoSegmentStore({
    jobs: [
      {
        id: jobId,
        userId,
        status: "post_qa_running",
        aspectRatio: "9:16",
        creditCost: 310,
      },
    ],
    segments,
    assets: [],
  });
}

describe("runPostQaCheck", () => {
  it("passes human-turn QA requirements to the vision provider", async () => {
    const stores = await createStores();
    const seenRequirements: string[][] = [];

    await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "strict",
      selectedTemplateIds: ["model_half_turn"],
      frameKeys: ["jobs/job-1/qa/frames/segment-0-frame-0.jpg"],
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      visionProvider: async (input) => {
        seenRequirements.push(input.qaRequirements);
        return {
          provider: "vision",
          model: "strict-test",
          qaJson: {
            passed: true,
            failure_category: null,
            checks: [],
            risk_flags: [],
            summary: "passed",
          },
          raw: {},
        };
      },
    });

    expect(seenRequirements[0]).toEqual(
      expect.arrayContaining([
        "same visible person across relevant frames",
        "natural head, arm, hand, hip, and leg anatomy",
        "garment front/side/back consistency",
        "turn stops at the supported angle and never completes 360 degrees",
      ]),
    );
  });

  it("stores the failed segment index from semantic frame names", async () => {
    const stores = await createStores();

    await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "strict",
      selectedTemplateIds: ["model_half_turn"],
      frameKeys: ["jobs/job-1/qa/frames/segment-2-frame-0.jpg"],
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      visionProvider: async () => ({
        provider: "vision",
        model: "strict-test",
        qaJson: {
          passed: false,
          failure_category: "human_anatomy",
          checks: [],
          risk_flags: ["unnatural_hand"],
          summary: "Segment 2 has an unnatural hand.",
        },
        raw: {},
      }),
    });

    expect(stores.postQaStore.listResults()[0]?.resultJson).toMatchObject({
      failedSegmentIndexes: [2],
    });
  });
  it("retries one precisely localized 40-second segment without releasing credits", async () => {
    const stores = await createStores();
    const segmentStore = createFiveSegmentStore();
    const frameKeys = [
      ...Array.from({ length: 5 }, (_, segmentIndex) =>
        Array.from(
          { length: 6 },
          (_, frameIndex) =>
            `jobs/job-1/qa/frames/segment-${segmentIndex}-frame-${frameIndex}.jpg`,
        ),
      ).flat(),
      ...Array.from(
        { length: 4 },
        (_, index) => `jobs/job-1/qa/frames/transition-${index}-${index + 1}.jpg`,
      ),
    ];

    const result = await runPostQaCheck({
      ...stores,
      segmentStore,
      jobId,
      userId,
      mode: "strict",
      frameKeys,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      visionProvider: async ({ frameUrls }) => {
        const passed = !frameUrls.some((url) => url.includes("segment-3-"));
        return {
          provider: "vision",
          model: "strict-test",
          qaJson: {
            passed,
            failure_category: passed ? null : "garment_mismatch",
            checks: [],
            risk_flags: [],
            summary: passed ? "ok" : "segment 3 failed",
          },
          raw: {},
        };
      },
    });

    expect(result).toMatchObject({
      jobId,
      status: "segments_queued",
      retriedSegmentIndex: 3,
      ledgerType: null,
    });
    expect(segmentStore.listSegments()[3]).toMatchObject({
      status: "queued",
      providerTaskId: null,
      videoKey: null,
    });
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
    ]);
  });

  it("evaluates a 40-second plan in five segment batches plus transitions", async () => {
    const stores = await createStores();
    const frameKeys = [
      ...Array.from({ length: 5 }, (_, segmentIndex) =>
        Array.from(
          { length: 4 },
          (_, frameIndex) =>
            `jobs/job-1/qa/frames/segment-${segmentIndex}-frame-${frameIndex}.jpg`,
        ),
      ).flat(),
      ...Array.from(
        { length: 4 },
        (_, index) => `jobs/job-1/qa/frames/transition-${index}-${index + 1}.jpg`,
      ),
    ];
    const providerInputs: string[][] = [];

    const result = await runPostQaCheck({
      ...stores,
      jobId,
      userId,
      mode: "standard",
      frameKeys,
      createSignedUrl: async ({ key }) => `https://r2.example/${key}`,
      visionProvider: async ({ frameUrls }) => {
        providerInputs.push(frameUrls);
        return {
          provider: "openai",
          model: "gpt-vision",
          qaJson: {
            passed: true,
            failure_category: null,
            risk_flags: [],
            checks: [],
          },
          raw: {},
        };
      },
    });

    expect(result).toEqual({
      jobId,
      status: "deliverable",
      ledgerType: "capture",
    });
    expect(providerInputs).toHaveLength(6);
    expect(Math.max(...providerInputs.map((input) => input.length))).toBe(4);
    expect(stores.providerCallLogStore.listCallLogs()).toHaveLength(6);
    expect(stores.postQaStore.listResults()[0]?.resultJson).toMatchObject({
      passed: true,
      batches: expect.arrayContaining([
        expect.objectContaining({ batchId: "segment-0", kind: "segment" }),
        expect.objectContaining({ batchId: "transitions", kind: "transition" }),
      ]),
    });
  });

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
