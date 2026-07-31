import { describe, expect, it } from "vitest";

import { handleGetAdminVirtualTryOnDetailRequest } from "./route";

describe("GET /api/admin/virtual-try-on/[id]", () => {
  it("returns 403 for non-admin callers and 404 for a missing job", async () => {
    const forbidden = await handleGetAdminVirtualTryOnDetailRequest(new Request("http://localhost/api/admin/virtual-try-on/job"), { params: { id: "job" } }, { getAdminSession: async () => null });
    const missing = await handleGetAdminVirtualTryOnDetailRequest(new Request("http://localhost/api/admin/virtual-try-on/job"), { params: { id: "job" } }, { getAdminSession: async () => ({ userId: "admin", email: "admin@example.com", role: "admin" }), getDetail: async () => null });
    expect(forbidden.status).toBe(403);
    expect(missing.status).toBe(404);
  });

  it("returns only the already-sanitized service detail", async () => {
    const response = await handleGetAdminVirtualTryOnDetailRequest(new Request("http://localhost/api/admin/virtual-try-on/job"), { params: { id: "job" } }, {
      getAdminSession: async () => ({ userId: "admin", email: "admin@example.com", role: "admin" }),
      getDetail: async () => ({ job: { id: "job", userId: "owner", mode: "front_only", status: "ready" }, views: [{ r2KeySuffix: "pack/front.png" }], providerLogs: [] }),
    });
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toMatch(/https?:\/\/|virtual-try-on\/job/iu);
  });
});
