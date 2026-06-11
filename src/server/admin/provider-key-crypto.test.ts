import { describe, expect, it } from "vitest";

import {
  createProviderKeyPreview,
  decryptProviderKey,
  encryptProviderKey,
} from "./provider-key-crypto";

describe("provider key crypto", () => {
  it("creates a masked key preview", () => {
    expect(createProviderKeyPreview("sk-live-1234567890abcdef")).toBe(
      "sk-l...cdef",
    );
  });

  it("encrypts and decrypts provider keys", () => {
    const secret = "12345678901234567890123456789012";
    const encrypted = encryptProviderKey("sk-test-secret", secret);

    expect(encrypted).not.toContain("sk-test-secret");
    expect(decryptProviderKey(encrypted, secret)).toBe("sk-test-secret");
  });
});
