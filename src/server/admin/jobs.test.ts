import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminJobStore,
  getAdminJobDetail,
} from "./jobs";

describe("admin job detail", () => {
  it("returns the full backend chain for a video job with readable diagnosis inputs", async () => {
    const store = createInMemoryAdminJobStore({
      jobs: [
        {
          id: "job-1",
          userId: "user-1",
          status: "segment_generating",
          userVisibleStatus: "generating",
          durationSeconds: 16,
          aspectRatio: "9:16",
          creditCost: 130,
          reservedLedgerId: "ledger-reserve",
          finalVideoKey: null,
          coverKey: null,
          isTest: false,
          failureReason: null,
          lastError: "provider still running",
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:08:00.000Z"),
        },
      ],
      assets: [
        {
          videoJobId: "job-1",
          assetId: "asset-1",
          role: "front",
          sortOrder: 0,
          fileName: "front.jpg",
          originalKey: "uploads/front.jpg",
          detectedRole: "front",
        },
      ],
      analyses: [
        {
          videoJobId: "job-1",
          assetId: "asset-1",
          analysisJson: {
            view_angle: "front",
          },
          mode: "standard",
        },
      ],
      storyboards: [
        {
          id: "storyboard-1",
          videoJobId: "job-1",
          status: "draft",
          selectedTemplateIds: ["front_push_in"],
          storyboardJson: {
            duration_seconds: 16,
            segments: [{ index: 0, template_id: "front_push_in" }],
          },
          finalPromptSnapshot: {
            prompt: "keep front view",
          },
          createdAt: new Date("2026-06-07T00:00:20.000Z"),
        },
      ],
      segments: [
        {
          id: "segment-1",
          videoJobId: "job-1",
          segmentIndex: 0,
          status: "generating",
          templateId: "front_push_in",
          provider: "evolink",
          model: "veo3.1-fast-beta",
          providerTaskId: "task-1",
          videoKey: null,
          prompt: "show front gently",
          lastError: null,
          attemptCount: 1,
        },
      ],
      providerLogs: [
        {
          id: "call-1",
          videoJobId: "job-1",
          segmentId: "segment-1",
          provider: "evolink",
          model: "veo3.1-fast-beta",
          purpose: "video_generation",
          status: "succeeded",
          durationMs: 4200,
          costEstimate: "2.100000",
          fallbackReason: null,
          responseSummary: { state: "accepted" },
          providerTaskId: "task-1",
          errorCode: null,
          errorMessage: null,
          createdAt: new Date("2026-06-07T00:01:00.000Z"),
        },
      ],
      moderationResults: [
        {
          id: "mod-1",
          videoJobId: "job-1",
          segmentId: null,
          source: "final_video_prompt",
          decision: "allow",
          provider: "creem",
          errorCode: null,
          errorMessage: null,
          createdAt: new Date("2026-06-07T00:00:30.000Z"),
        },
      ],
      ledger: [
        {
          id: "ledger-reserve",
          userId: "user-1",
          relatedJobId: "job-1",
          type: "reserve",
          amount: 130,
          balanceBefore: 300,
          balanceAfter: 170,
          reason: "job reserve",
          idempotencyKey: "reserve:job-1",
          createdAt: new Date("2026-06-07T00:00:40.000Z"),
        },
      ],
      stitchJobs: [
        {
          id: "stitch-1",
          videoJobId: "job-1",
          status: "queued",
          segmentKeys: ["jobs/job-1/segments/segment-1/video.mp4"],
          finalVideoKey: null,
          coverKey: null,
          frameKeys: [],
          lastError: null,
        },
      ],
      postQaResults: [
        {
          id: "qa-1",
          videoJobId: "job-1",
          status: "queued",
          mode: "standard",
          failureCategory: null,
          frameKeys: [],
          resultJson: null,
          createdAt: new Date("2026-06-07T00:09:00.000Z"),
        },
      ],
      stateEvents: [
        {
          id: "evt-1",
          videoJobId: "job-1",
          segmentId: null,
          fromStatus: "segments_queued",
          toStatus: "segment_generating",
          reason: "worker_claimed_segment",
          actorType: "system",
          actorId: null,
          eventSnapshot: { segmentId: "segment-1" },
          createdAt: new Date("2026-06-07T00:00:10.000Z"),
        },
      ],
    });

    const detail = await getAdminJobDetail({
      store,
      jobId: "job-1",
      now: new Date("2026-06-07T00:12:00.000Z"),
    });

    expect(detail).toEqual({
      job: expect.objectContaining({
        id: "job-1",
        status: "segment_generating",
        lastError: "provider still running",
        updatedAt: new Date("2026-06-07T00:08:00.000Z"),
      }),
      diagnosis: expect.objectContaining({
        kind: "in_progress",
      }),
      assets: [expect.objectContaining({ assetId: "asset-1" })],
      analyses: [expect.objectContaining({ assetId: "asset-1", mode: "standard" })],
      latestStoryboard: expect.objectContaining({
        id: "storyboard-1",
        finalPromptSnapshot: { prompt: "keep front view" },
      }),
      segments: [
        expect.objectContaining({
          id: "segment-1",
          providerTaskId: "task-1",
          attemptCount: 1,
          lastError: null,
        }),
      ],
      providerLogs: [
        expect.objectContaining({
          id: "call-1",
          responseSummary: { state: "accepted" },
        }),
      ],
      moderationResults: [expect.objectContaining({ id: "mod-1" })],
      ledger: [expect.objectContaining({ id: "ledger-reserve" })],
      stitchJobs: [expect.objectContaining({ id: "stitch-1" })],
      postQaResults: [expect.objectContaining({ id: "qa-1" })],
      stateEvents: [expect.objectContaining({ id: "evt-1" })],
    });
  });

  it("diagnoses a deliverable job", async () => {
    const detail = await getAdminJobDetail({
      store: createInMemoryAdminJobStore({
        jobs: [
          {
            id: "job-deliverable",
            userId: "user-1",
            status: "deliverable",
            userVisibleStatus: "downloadable",
            durationSeconds: 8,
            aspectRatio: "9:16",
            creditCost: 70,
            reservedLedgerId: null,
            finalVideoKey: "jobs/job-deliverable/stitched/final.mp4",
            coverKey: "jobs/job-deliverable/covers/cover.webp",
            isTest: false,
            failureReason: null,
            lastError: null,
            createdAt: new Date("2026-06-11T00:00:00.000Z"),
            updatedAt: new Date("2026-06-11T00:05:00.000Z"),
          },
        ],
        segments: [],
        providerLogs: [],
        moderationResults: [],
        ledger: [
          {
            id: "ledger-capture",
            userId: "user-1",
            relatedJobId: "job-deliverable",
            type: "capture",
            amount: 70,
            balanceBefore: 30,
            balanceAfter: 30,
            reason: "capture credits after post QA passed",
            idempotencyKey: "capture:job:job-deliverable",
            createdAt: new Date("2026-06-11T00:06:00.000Z"),
          },
        ],
        stitchJobs: [],
        postQaResults: [],
      }),
      jobId: "job-deliverable",
      now: new Date("2026-06-11T00:10:00.000Z"),
    });

    expect(detail?.diagnosis).toEqual(
      expect.objectContaining({
        kind: "deliverable",
        severity: "info",
      }),
    );
  });

  it("diagnoses delivered paid jobs without captured credits", async () => {
    const detail = await getAdminJobDetail({
      store: createInMemoryAdminJobStore({
        jobs: [
          {
            id: "job-delivered-without-capture",
            userId: "user-1",
            status: "deliverable",
            userVisibleStatus: "downloadable",
            durationSeconds: 8,
            aspectRatio: "9:16",
            creditCost: 70,
            reservedLedgerId: null,
            finalVideoKey: "jobs/job-delivered-without-capture/stitched/final.mp4",
            coverKey: "jobs/job-delivered-without-capture/covers/cover.webp",
            isTest: false,
            failureReason: null,
            lastError: null,
            createdAt: new Date("2026-06-11T00:00:00.000Z"),
            updatedAt: new Date("2026-06-11T00:05:00.000Z"),
          },
        ],
        segments: [],
        providerLogs: [],
        moderationResults: [],
        ledger: [],
        stitchJobs: [],
        postQaResults: [],
      }),
      jobId: "job-delivered-without-capture",
      now: new Date("2026-06-11T00:10:00.000Z"),
    });

    expect(detail?.diagnosis).toEqual(
      expect.objectContaining({
        kind: "credits_need_attention",
        severity: "critical",
      }),
    );
  });

  it("diagnoses stalled post qa jobs", async () => {
    const detail = await getAdminJobDetail({
      store: createInMemoryAdminJobStore({
        jobs: [
          {
            id: "job-qa-stale",
            userId: "user-1",
            status: "post_qa_queued",
            userVisibleStatus: "quality_checking",
            durationSeconds: 16,
            aspectRatio: "9:16",
            creditCost: 130,
            reservedLedgerId: "ledger-reserve",
            finalVideoKey: "jobs/job-qa-stale/stitched/final.mp4",
            coverKey: null,
            isTest: false,
            failureReason: null,
            lastError: null,
            createdAt: new Date("2026-06-11T00:00:00.000Z"),
            updatedAt: new Date("2026-06-11T00:01:00.000Z"),
          },
        ],
        segments: [],
        providerLogs: [],
        moderationResults: [],
        ledger: [],
        stitchJobs: [],
        postQaResults: [],
      }),
      jobId: "job-qa-stale",
      now: new Date("2026-06-11T00:20:30.000Z"),
    });

    expect(detail?.diagnosis).toEqual(
      expect.objectContaining({
        kind: "post_qa_stalled",
        severity: "warning",
      }),
    );
  });

  it("diagnoses failed segments and recommends segment retry", async () => {
    const detail = await getAdminJobDetail({
      store: createInMemoryAdminJobStore({
        jobs: [
          {
            id: "job-segment-failed",
            userId: "user-1",
            status: "segment_failed",
            userVisibleStatus: "failed",
            durationSeconds: 16,
            aspectRatio: "9:16",
            creditCost: 130,
            reservedLedgerId: "ledger-reserve",
            finalVideoKey: null,
            coverKey: null,
            isTest: false,
            failureReason: "provider failed",
            lastError: "provider failed",
            createdAt: new Date("2026-06-11T00:00:00.000Z"),
            updatedAt: new Date("2026-06-11T00:05:00.000Z"),
          },
        ],
        segments: [
          {
            id: "segment-1",
            videoJobId: "job-segment-failed",
            segmentIndex: 0,
            status: "failed",
            templateId: "front_push_in",
            provider: "evolink",
            model: "veo3.1-fast-beta",
            providerTaskId: "task-1",
            videoKey: null,
            prompt: "keep front",
            lastError: "provider failed",
            attemptCount: 2,
          },
        ],
        providerLogs: [],
        moderationResults: [],
        ledger: [],
        stitchJobs: [],
        postQaResults: [],
      }),
      jobId: "job-segment-failed",
      now: new Date("2026-06-11T00:06:00.000Z"),
    });

    expect(detail?.diagnosis).toEqual(
      expect.objectContaining({
        kind: "segment_failed",
        severity: "critical",
      }),
    );
  });

  it("diagnoses stitch failures and missing final video keys", async () => {
    const detail = await getAdminJobDetail({
      store: createInMemoryAdminJobStore({
        jobs: [
          {
            id: "job-stitch-failed",
            userId: "user-1",
            status: "stitching_running",
            userVisibleStatus: "generating",
            durationSeconds: 16,
            aspectRatio: "9:16",
            creditCost: 130,
            reservedLedgerId: "ledger-reserve",
            finalVideoKey: null,
            coverKey: null,
            isTest: false,
            failureReason: null,
            lastError: "ffmpeg missing output",
            createdAt: new Date("2026-06-11T00:00:00.000Z"),
            updatedAt: new Date("2026-06-11T00:15:00.000Z"),
          },
        ],
        segments: [],
        providerLogs: [],
        moderationResults: [],
        ledger: [],
        stitchJobs: [
          {
            id: "stitch-1",
            videoJobId: "job-stitch-failed",
            status: "failed",
            segmentKeys: ["a.mp4"],
            finalVideoKey: null,
            coverKey: null,
            frameKeys: [],
            lastError: "ffmpeg missing output",
          },
        ],
        postQaResults: [],
      }),
      jobId: "job-stitch-failed",
      now: new Date("2026-06-11T00:16:00.000Z"),
    });

    expect(detail?.diagnosis).toEqual(
      expect.objectContaining({
        kind: "stitch_failed",
        severity: "critical",
      }),
    );
  });

  it("diagnoses moderation blocks", async () => {
    const detail = await getAdminJobDetail({
      store: createInMemoryAdminJobStore({
        jobs: [
          {
            id: "job-moderation",
            userId: "user-1",
            status: "prompt_moderation_blocked",
            userVisibleStatus: "failed",
            durationSeconds: 8,
            aspectRatio: "9:16",
            creditCost: 70,
            reservedLedgerId: null,
            finalVideoKey: null,
            coverKey: null,
            isTest: false,
            failureReason: "moderation blocked",
            lastError: null,
            createdAt: new Date("2026-06-11T00:00:00.000Z"),
            updatedAt: new Date("2026-06-11T00:01:00.000Z"),
          },
        ],
        segments: [],
        providerLogs: [],
        moderationResults: [
          {
            id: "mod-1",
            videoJobId: "job-moderation",
            segmentId: null,
            source: "final_video_prompt",
            decision: "deny",
            provider: "creem",
            errorCode: "blocked",
            errorMessage: "policy",
            createdAt: new Date("2026-06-11T00:00:30.000Z"),
          },
        ],
        ledger: [],
        stitchJobs: [],
        postQaResults: [],
      }),
      jobId: "job-moderation",
      now: new Date("2026-06-11T00:05:00.000Z"),
    });

    expect(detail?.diagnosis).toEqual(
      expect.objectContaining({
        kind: "moderation_blocked",
        severity: "critical",
      }),
    );
  });

  it("diagnoses frozen credits that still need attention after failure", async () => {
    const detail = await getAdminJobDetail({
      store: createInMemoryAdminJobStore({
        jobs: [
          {
            id: "job-credits",
            userId: "user-1",
            status: "failed_refunded",
            userVisibleStatus: "failed",
            durationSeconds: 8,
            aspectRatio: "9:16",
            creditCost: 70,
            reservedLedgerId: "ledger-reserve",
            finalVideoKey: null,
            coverKey: null,
            isTest: false,
            failureReason: "provider failed",
            lastError: "provider failed",
            createdAt: new Date("2026-06-11T00:00:00.000Z"),
            updatedAt: new Date("2026-06-11T00:02:00.000Z"),
          },
        ],
        segments: [],
        providerLogs: [],
        moderationResults: [],
        ledger: [
          {
            id: "ledger-reserve",
            userId: "user-1",
            relatedJobId: "job-credits",
            type: "reserve",
            amount: 70,
            balanceBefore: 100,
            balanceAfter: 30,
            reason: "reserve",
            idempotencyKey: "reserve:job-credits",
            createdAt: new Date("2026-06-11T00:00:30.000Z"),
          },
        ],
        stitchJobs: [],
        postQaResults: [],
      }),
      jobId: "job-credits",
      now: new Date("2026-06-11T00:05:00.000Z"),
    });

    expect(detail?.diagnosis).toEqual(
      expect.objectContaining({
        kind: "credits_need_attention",
        severity: "warning",
      }),
    );
  });
});
