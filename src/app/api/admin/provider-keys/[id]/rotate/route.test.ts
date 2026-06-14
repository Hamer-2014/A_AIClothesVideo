import { describe, expect, it } from "vitest";

import { handleRotateProviderKeyRequest } from "./route";

const admin = {
  userId: "admin-1",
  email: "admin@example.com",
  role: "admin" as const,
};

function request(body: unknown) {
  return new Request("http://localhost/api/admin/provider-keys/key-1/rotate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/provider-keys/[id]/rotate", () => {
  it("rejects unauthenticated users", async () => {
    const response = await handleRotateProviderKeyRequest(
      request({ plainKey: "sk-test", reason: "rotate key" }),
      { params: { id: "key-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("returns gone for authenticated users because provider keys are env-only", async () => {
    const response = await handleRotateProviderKeyRequest(
      request({ plainKey: "sk-test", reason: "short" }),
      { params: { id: "key-1" } },
      { getAdminSession: async () => admin },
    );

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: "provider_keys_retired",
    });
  });

  it("returns gone before accepting any provider key rotation workflow", async () => {
    const response = await handleRotateProviderKeyRequest(
      request({ plainKey: "sk-test", reason: "operator attempt" }),
      { params: { id: "key-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "ops@example.com",
          role: "operator",
        }),
      },
    );

    expect(response.status).toBe(410);
  });

  it("does not parse or return submitted secrets", async () => {
    const response = await handleRotateProviderKeyRequest(
      request({ plainKey: "sk-rotated-secret", reason: "rotate key" }),
      { params: { id: "key-1" } },
      {
        getAdminSession: async () => admin,
      },
    );

    expect(response.status).toBe(410);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("sk-rotated-secret");
    expect(serialized).not.toContain("encrypted");
  });
});
