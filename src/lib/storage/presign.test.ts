import { describe, expect, it, vi } from "vitest";
import type { GetObjectCommandInput } from "@aws-sdk/client-s3";

import { createDownloadSignedUrl, createUploadSignedUrl } from "./presign";

const fakeClient = {} as never;

describe("R2 presign helpers", () => {
  it("creates upload signed URL with bucket, key, and content type", async () => {
    const result = await createUploadSignedUrl({
      bucket: "bucket",
      key: "users/u/assets/a/original.jpg",
      contentType: "image/jpeg",
      expiresIn: 300,
      client: fakeClient,
      signer: async (_client, command, options) => {
        expect(command.input).toMatchObject({
          Bucket: "bucket",
          Key: "users/u/assets/a/original.jpg",
          ContentType: "image/jpeg",
        });
        expect(options).toMatchObject({ expiresIn: 300 });
        return "https://signed-upload.example";
      },
    });

    expect(result).toEqual({
      url: "https://signed-upload.example",
      headers: {
        "content-type": "image/jpeg",
      },
    });
  });

  it("creates download signed URL with bucket and key", async () => {
    const result = await createDownloadSignedUrl({
      bucket: "bucket",
      key: "users/u/assets/a/original.jpg",
      expiresIn: 600,
      client: fakeClient,
      signer: async (_client, command, options) => {
        expect(command.input).toMatchObject({
          Bucket: "bucket",
          Key: "users/u/assets/a/original.jpg",
        });
        expect(options).toMatchObject({ expiresIn: 600 });
        return "https://signed-download.example";
      },
    });

    expect(result).toBe("https://signed-download.example");
  });

  it("adds content disposition for attachment downloads with custom filenames", async () => {
    const signer: Parameters<typeof createDownloadSignedUrl>[0]["signer"] =
      vi.fn(async () => "https://signed.example/final.mp4");

    await createDownloadSignedUrl({
      bucket: "bucket",
      key: "jobs/job-1/stitched/final.mp4",
      filename: "spring dress.mp4",
      signer,
      client: {} as never,
    });

    const mockedSigner = vi.mocked(signer);
    const commandInput = mockedSigner.mock.calls[0]?.[1].input as
      | GetObjectCommandInput
      | undefined;
    expect(commandInput).toMatchObject({
      Bucket: "bucket",
      Key: "jobs/job-1/stitched/final.mp4",
      ResponseContentDisposition:
        "attachment; filename=\"spring dress.mp4\"; filename*=UTF-8''spring%20dress.mp4",
    });
  });
});
