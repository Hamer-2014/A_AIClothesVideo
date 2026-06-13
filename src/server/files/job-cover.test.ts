import { afterEach, describe, expect, it, vi } from "vitest";

import * as presign from "@/lib/storage/presign";

import { createInMemoryJobCoverStore, createJobCoverUrl } from "./job-cover";

describe("createJobCoverUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a signed cover URL only for the owner of a deliverable job", async () => {
    const signedUrlSpy = vi
      .spyOn(presign, "createDownloadSignedUrl")
      .mockResolvedValue("https://download.example/cover.webp");

    const result = await createJobCoverUrl({
      store: createInMemoryJobCoverStore([
        {
          id: "job-1",
          userId: "user-1",
          status: "deliverable",
          coverKey: "jobs/job-1/covers/cover.webp",
        },
      ]),
      jobId: "job-1",
      userId: "user-1",
    });

    expect(result).toEqual({
      url: "https://download.example/cover.webp",
      expiresIn: 900,
    });
    expect(signedUrlSpy).toHaveBeenCalledWith({
      key: "jobs/job-1/covers/cover.webp",
      expiresIn: 900,
    });
  });

  it("rejects cover access before the job is deliverable", async () => {
    await expect(
      createJobCoverUrl({
        store: createInMemoryJobCoverStore([
          {
            id: "job-1",
            userId: "user-1",
            status: "post_qa_running",
            coverKey: "jobs/job-1/covers/cover.webp",
          },
        ]),
        jobId: "job-1",
        userId: "user-1",
      }),
    ).rejects.toThrow("Video job cover is not available.");
  });
});
