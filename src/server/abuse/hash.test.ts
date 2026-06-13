import { describe, expect, it } from "vitest";

import { hashAbuseSignal } from "./hash";

describe("hashAbuseSignal", () => {
  it("returns null for empty input", () => {
    expect(hashAbuseSignal(null, "secret")).toBeNull();
    expect(hashAbuseSignal("", "secret")).toBeNull();
    expect(hashAbuseSignal("   ", "secret")).toBeNull();
  });

  it("uses HMAC-SHA256 with the server secret", () => {
    expect(hashAbuseSignal("User@Example.com", "secret-a")).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(hashAbuseSignal("User@Example.com", "secret-a")).toBe(
      hashAbuseSignal("User@Example.com", "secret-a"),
    );
    expect(hashAbuseSignal("User@Example.com", "secret-a")).not.toBe(
      hashAbuseSignal("User@Example.com", "secret-b"),
    );
  });
});
