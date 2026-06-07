import { describe, expect, it } from "vitest";

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
});
