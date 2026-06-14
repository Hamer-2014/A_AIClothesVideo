import { describe, expect, it } from "vitest";

import { handleUpdateProviderKeyStatusRequest } from "./route";

describe("POST /api/admin/provider-keys/[id]/status", () => {
  it("requires admin access", async () => {
    const response = await handleUpdateProviderKeyStatusRequest(
      new Request("http://localhost/api/admin/provider-keys/key-1/status", {
        method: "POST",
        body: JSON.stringify({ status: "active", reason: "enable" }),
      }),
      { params: { id: "key-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("returns gone for authenticated users because provider keys are env-only", async () => {
    const response = await handleUpdateProviderKeyStatusRequest(
      new Request("http://localhost/api/admin/provider-keys/key-1/status", {
        method: "POST",
        body: JSON.stringify({ status: "active", reason: "enable" }),
      }),
      { params: { id: "key-1" } },
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
      },
    );

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      error: "provider_keys_retired",
    });
  });

  it("does not validate retired status payloads", async () => {
    for (const reason of ["", "   ", "short"]) {
      const response = await handleUpdateProviderKeyStatusRequest(
        new Request("http://localhost/api/admin/provider-keys/key-1/status", {
          method: "POST",
          body: JSON.stringify({ status: "active", reason }),
        }),
        { params: { id: "key-1" } },
        {
          getAdminSession: async () => ({
            userId: "admin-1",
            email: "admin@example.com",
            role: "admin",
          }),
        },
      );

      expect(response.status).toBe(410);
    }
  });
});
