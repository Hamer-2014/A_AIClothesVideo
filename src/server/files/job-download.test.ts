import { afterEach, describe, expect, it, vi } from "vitest";

import * as presign from "@/lib/storage/presign";

import {
  createInMemoryJobDownloadStore,
  createJobDownloadUrl,
  createPublicJobVideoUrl,
} from "./job-download";

describe("createJobDownloadUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      filename: "video.mp4",
    });
  });

  it("passes a custom filename to the signed download URL", async () => {
    const signedUrlSpy = vi
      .spyOn(presign, "createDownloadSignedUrl")
      .mockResolvedValue("https://download.example/final.mp4");

    await createJobDownloadUrl({
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
      filename: "spring-dress.mp4",
    });

    expect(signedUrlSpy).toHaveBeenCalledWith({
      key: "jobs/job-1/stitched/final.mp4",
      expiresIn: 900,
      filename: "spring-dress.mp4",
    });
  });

  it("sanitizes unsafe custom filenames before signing", async () => {
    const signedUrlSpy = vi
      .spyOn(presign, "createDownloadSignedUrl")
      .mockResolvedValue("https://download.example/final.mp4");

    await createJobDownloadUrl({
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
      filename: "../spring/dress?.mov",
    });

    expect(signedUrlSpy).toHaveBeenCalledWith({
      key: "jobs/job-1/stitched/final.mp4",
      expiresIn: 900,
      filename: "spring_dress_.mov.mp4",
    });
  });

  it("builds a public custom-domain URL for preview when configured", () => {
    expect(
      createPublicJobVideoUrl({
        key: "jobs/job-1/stitched/final.mp4",
        publicBaseUrl: "https://cdn.example.com/videos/",
      }),
    ).toBe("https://cdn.example.com/videos/jobs/job-1/stitched/final.mp4");
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
