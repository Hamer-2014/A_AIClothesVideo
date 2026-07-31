import { describe, expect, it } from "vitest";

import { handleGetAdminVirtualTryOnListRequest } from "./route";

describe("GET /api/admin/virtual-try-on", () => {
  it("rejects non-admin callers and validates bounded pagination input", async () => {
    const forbidden = await handleGetAdminVirtualTryOnListRequest(new Request("http://localhost/api/admin/virtual-try-on"), { getAdminSession: async () => null });
    const invalid = await handleGetAdminVirtualTryOnListRequest(new Request("http://localhost/api/admin/virtual-try-on?limit=0"), { getAdminSession: async () => ({ userId: "admin", email: "admin@example.com", role: "admin" }), list: async () => ({ items: [], nextCursor: null }) });
    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
  });

  it("returns the service's safe page only to an admin", async () => {
    const response = await handleGetAdminVirtualTryOnListRequest(new Request("http://localhost/api/admin/virtual-try-on?limit=2&cursor=1%7Cjob"), {
      getAdminSession: async () => ({ userId: "admin", email: "admin@example.com", role: "admin" }),
      list: async (input) => {
        expect(input).toEqual({ limit: 2, cursor: "1|job" });
        return { items: [{ id: "job", userId: "owner", mode: "front_only", status: "queued", isTest: false, pack: { version: 1, requiredViews: ["front"] }, createdAt: new Date("2026-08-01T00:00:00.000Z") }], nextCursor: null };
      },
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/https?:\/\/|r2Key|requestSnapshot/iu);
  });
});
