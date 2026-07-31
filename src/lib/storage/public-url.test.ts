import { describe, expect, it } from "vitest";

import { createR2PublicUrl } from "./public-url";

describe("createR2PublicUrl", () => {
  it("preserves the configured base path and encodes object-key segments", () => {
    expect(
      createR2PublicUrl({
        key: "uploads/look book/front #1.jpg",
        publicBaseUrl: "https://media.example.com/assets/",
      }),
    ).toBe("https://media.example.com/assets/uploads/look%20book/front%20%231.jpg");
  });

  it.each(["uploads/../front.jpg", "uploads/./front.jpg"])(
    "rejects an ambiguous dot segment in an object key: %s",
    (key) => {
      expect(() =>
        createR2PublicUrl({
          key,
          publicBaseUrl: "https://media.example.com/assets",
        }),
      ).toThrow("R2 object key cannot contain dot path segments");
    },
  );

  it.each([
    "http://media.example.com",
    "https://user:secret@media.example.com",
    "https://media.example.com?token=secret",
    "https://media.example.com#assets",
  ])("rejects an invalid public base URL: %s", (publicBaseUrl) => {
    expect(() => createR2PublicUrl({ key: "front.jpg", publicBaseUrl })).toThrow(
      "CLOUDFLARE_R2_PUBLIC_BASE_URL must be a plain HTTPS URL",
    );
  });
});
