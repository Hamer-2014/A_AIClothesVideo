import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminJobStore,
  getAdminJobDetail,
} from "./jobs";

describe("admin job detail", () => {
  it("returns the full backend chain for a video job", async () => {
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
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
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
          model: "veo3.1-pro-beta",
          providerTaskId: "task-1",
          videoKey: null,
        },
      ],
      providerLogs: [
        {
          id: "call-1",
          videoJobId: "job-1",
          segmentId: "segment-1",
          provider: "evolink",
          model: "veo3.1-pro-beta",
          purpose: "video_generation",
          status: "succeeded",
          providerTaskId: "task-1",
          createdAt: new Date("2026-06-07T00:01:00.000Z"),
        },
      ],
      moderationResults: [
        {
          id: "mod-1",
          videoJobId: "job-1",
          source: "final_video_prompt",
          decision: "allow",
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
          createdAt: new Date("2026-06-07T00:00:40.000Z"),
        },
      ],
      stitchJobs: [],
      postQaResults: [],
    });

    const detail = await getAdminJobDetail({ store, jobId: "job-1" });

    expect(detail).toEqual({
      job: expect.objectContaining({
        id: "job-1",
        status: "segment_generating",
      }),
      segments: [
        expect.objectContaining({
          id: "segment-1",
          providerTaskId: "task-1",
        }),
      ],
      providerLogs: [expect.objectContaining({ id: "call-1" })],
      moderationResults: [expect.objectContaining({ id: "mod-1" })],
      ledger: [expect.objectContaining({ id: "ledger-reserve" })],
      stitchJobs: [],
      postQaResults: [],
    });
  });
});
