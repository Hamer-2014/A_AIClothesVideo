import { describe, expect, it } from "vitest";

import { handleGetProvidersRequest } from "./route";

describe("GET /api/admin/providers", () => {
  it("returns 403 for non-admin users", async () => {
    const response = await handleGetProvidersRequest(
      new Request("http://localhost/api/admin/providers"),
      {
        getAdminSession: async () => null,
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns provider ops overview", async () => {
    const response = await handleGetProvidersRequest(
      new Request("http://localhost/api/admin/providers"),
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
        getOverview: async () => ({
          providers: [{ id: "provider-1", name: "evolink" }],
          keys: [{ id: "key-1", keyPreview: "sk_...1234" }],
          routes: [{ id: "route-1", purpose: "video_generation" }],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      providers: [{ id: "provider-1", name: "evolink" }],
      keys: [{ id: "key-1", keyPreview: "sk_...1234" }],
      routes: [{ id: "route-1", purpose: "video_generation" }],
    });
  });
});
