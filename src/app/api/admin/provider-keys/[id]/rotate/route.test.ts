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

  it("rejects short reasons", async () => {
    const response = await handleRotateProviderKeyRequest(
      request({ plainKey: "sk-test", reason: "short" }),
      { params: { id: "key-1" } },
      { getAdminSession: async () => admin },
    );

    expect(response.status).toBe(400);
  });

  it("maps operator rotation denial to forbidden", async () => {
    const response = await handleRotateProviderKeyRequest(
      request({ plainKey: "sk-test", reason: "operator attempt" }),
      { params: { id: "key-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "ops@example.com",
          role: "operator",
        }),
        rotateKey: async () => {
          throw new Error("Actor cannot rotate provider keys.");
        },
      },
    );

    expect(response.status).toBe(403);
  });

  it("reports missing provider key encryption configuration", async () => {
    const response = await handleRotateProviderKeyRequest(
      request({ plainKey: "sk-test", reason: "missing encryption" }),
      { params: { id: "key-1" } },
      {
        getAdminSession: async () => admin,
        rotateKey: async () => {
          throw new Error(
            "PROVIDER_KEY_ENCRYPTION_SECRET must be at least 32 characters.",
          );
        },
      },
    );

    expect(response.status).toBe(503);
  });

  it("does not return plain or encrypted keys", async () => {
    const response = await handleRotateProviderKeyRequest(
      request({ plainKey: "sk-rotated-secret", reason: "rotate key" }),
      { params: { id: "key-1" } },
      {
        getAdminSession: async () => admin,
        rotateKey: async () => ({
          id: "key-1",
          keyPreview: "sk-r...cret",
        }),
      },
    );

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("sk-rotated-secret");
    expect(serialized).not.toContain("encrypted");
  });
});
