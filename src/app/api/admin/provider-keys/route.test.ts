import { describe, expect, it } from "vitest";

import { handleCreateProviderKeyRequest } from "./route";

const admin = {
  userId: "admin-1",
  email: "admin@example.com",
  role: "admin" as const,
};

function request(body: unknown) {
  return new Request("http://localhost/api/admin/provider-keys", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/provider-keys", () => {
  it("rejects unauthenticated users", async () => {
    const response = await handleCreateProviderKeyRequest(request({}), {
      getAdminSession: async () => null,
    });

    expect(response.status).toBe(403);
  });

  it("rejects short reasons", async () => {
    const response = await handleCreateProviderKeyRequest(
      request({
        providerId: "provider-1",
        label: "main",
        environment: "staging",
        plainKey: "sk-test",
        dailyCostLimit: "20",
        concurrentLimit: 1,
        status: "paused",
        reason: "short",
      }),
      { getAdminSession: async () => admin },
    );

    expect(response.status).toBe(400);
  });

  it("maps operator creation denial to forbidden", async () => {
    const response = await handleCreateProviderKeyRequest(
      request({
        providerId: "provider-1",
        label: "main",
        environment: "staging",
        plainKey: "sk-test",
        dailyCostLimit: "20",
        concurrentLimit: 1,
        status: "paused",
        reason: "operator attempt",
      }),
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "ops@example.com",
          role: "operator",
        }),
        createKey: async () => {
          throw new Error("Actor cannot create provider keys.");
        },
      },
    );

    expect(response.status).toBe(403);
  });

  it("reports missing provider key encryption configuration", async () => {
    const response = await handleCreateProviderKeyRequest(
      request({
        providerId: "provider-1",
        label: "main",
        environment: "staging",
        plainKey: "sk-test",
        dailyCostLimit: "20",
        concurrentLimit: 1,
        status: "paused",
        reason: "missing encryption",
      }),
      {
        getAdminSession: async () => admin,
        createKey: async () => {
          throw new Error(
            "PROVIDER_KEY_ENCRYPTION_SECRET must be at least 32 characters.",
          );
        },
      },
    );

    expect(response.status).toBe(503);
  });

  it("does not return plain or encrypted keys", async () => {
    const response = await handleCreateProviderKeyRequest(
      request({
        providerId: "provider-1",
        label: "main",
        environment: "staging",
        plainKey: "sk-test-secret",
        dailyCostLimit: "20",
        concurrentLimit: 1,
        status: "paused",
        reason: "initial key",
      }),
      {
        getAdminSession: async () => admin,
        createKey: async () => ({
          id: "key-1",
          keyPreview: "sk-t...cret",
        }),
      },
    );

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("sk-test-secret");
    expect(serialized).not.toContain("encrypted");
  });
});
