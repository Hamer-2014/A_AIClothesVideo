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

  it("returns gone for authenticated users because provider keys are env-only", async () => {
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

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: "provider_keys_retired",
    });
  });

  it("returns gone before accepting any provider key creation workflow", async () => {
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
      },
    );

    expect(response.status).toBe(410);
  });

  it("does not parse or return submitted secrets", async () => {
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
      },
    );

    expect(response.status).toBe(410);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("sk-test-secret");
    expect(serialized).not.toContain("encrypted");
  });
});
