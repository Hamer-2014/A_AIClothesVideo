import { PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { transferRemoteFileToR2 } from "./transfer";

describe("transferRemoteFileToR2", () => {
  it("downloads a remote file and uploads it to R2", async () => {
    const send = vi.fn(async () => ({}));
    const client = { send };
    const fetchImpl = vi.fn(async () => {
      return new Response("video-bytes", {
        status: 200,
        headers: { "content-type": "video/mp4" },
      });
    });

    const result = await transferRemoteFileToR2({
      url: "https://provider.example/video.mp4",
      key: "jobs/job-1/segments/segment-1/video.mp4",
      bucket: "private-bucket",
      client,
      fetch: fetchImpl,
    });

    expect(result).toEqual({
      key: "jobs/job-1/segments/segment-1/video.mp4",
      contentType: "video/mp4",
    });
    expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
  });

  it("fails closed when provider output cannot be downloaded", async () => {
    await expect(
      transferRemoteFileToR2({
        url: "https://provider.example/missing.mp4",
        key: "jobs/job-1/segments/segment-1/video.mp4",
        bucket: "private-bucket",
        client: { send: vi.fn() },
        fetch: async () => new Response("missing", { status: 404 }),
      }),
    ).rejects.toThrow("Remote file download failed with status 404.");
  });
});
