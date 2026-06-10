import { describe, expect, it, vi } from "vitest";

import * as presign from "@/lib/storage/presign";

import {
  createInMemoryJobDownloadStore,
  createJobDownloadUrl,
} from "./job-download";

describe("createJobDownloadUrl", () => {
  it("creates a signed URL only for the owner of a deliverable job", async () => {
    const signedUrlSpy = vi
      .spyOn(presign, "createDownloadSignedUrl")
      .mockResolvedValue("https://download.example/final.mp4");

    const result = await createJobDownloadUrl({
      store: createInMemoryJobDownloadStore([
        {
          id: "job-1",
          userId: "user-1",
          status: "deliverable",
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
        },
      ]),
      jobId: "job-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      url: "https://download.example/final.mp4",
      expiresIn: 900,
    });
    expect(signedUrlSpy).toHaveBeenCalledWith({
      key: "jobs/job-1/stitched/final.mp4",
      expiresIn: 900,
    });
  });

  it("rejects downloads for non-deliverable jobs", async () => {
    await expect(
      createJobDownloadUrl({
        store: createInMemoryJobDownloadStore([
          {
            id: "job-1",
            userId: "user-1",
            status: "post_qa_running",
            finalVideoKey: "jobs/job-1/stitched/final.mp4",
          },
        ]),
        jobId: "job-1",
        userId: "user-1",
      }),
    ).rejects.toThrow("Video job is not downloadable.");
  });
});
