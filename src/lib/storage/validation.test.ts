import { describe, expect, it } from "vitest";

import { validateUploadFile } from "./validation";

describe("upload validation", () => {
  it("accepts MVP image types under the size limit", () => {
    expect(
      validateUploadFile({
        fileName: "dress.png",
        mimeType: "image/png",
        fileSize: 1024,
      }),
    ).toMatchObject({ ok: true, extension: "png", mimeType: "image/png" });
  });

  it("rejects unsupported types and oversized files", () => {
    expect(
      validateUploadFile({
        fileName: "dress.gif",
        mimeType: "image/gif",
        fileSize: 1024,
      }),
    ).toMatchObject({ ok: false, reason: "unsupported_file_type" });

    expect(
      validateUploadFile({
        fileName: "dress.jpg",
        mimeType: "image/jpeg",
        fileSize: 16 * 1024 * 1024,
      }),
    ).toMatchObject({ ok: false, reason: "file_too_large" });
  });
});
