import { describe, expect, it } from "vitest";

import { handleUpdateModelRouteRequest } from "./route";

describe("POST /api/admin/model-routes/[id]", () => {
  it("requires admin access", async () => {
    const response = await handleUpdateModelRouteRequest(
      new Request("http://localhost/api/admin/model-routes/route-1", {
        method: "POST",
        body: JSON.stringify({
          status: "active",
          reason: "enable route",
        }),
      }),
      { params: { id: "route-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("returns gone for authenticated users because DB model routes are retired", async () => {
    const response = await handleUpdateModelRouteRequest(
      new Request("http://localhost/api/admin/model-routes/route-1", {
        method: "POST",
        body: JSON.stringify({
          status: "active",
          primaryModel: "veo3.1-fast-beta",
          minMarginPercent: 50,
          allowPublicFallback: false,
          reason: "enable route",
        }),
      }),
      { params: { id: "route-1" } },
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
      error: "model_routes_retired",
    });
  });

  it("does not validate retired route payloads", async () => {
    for (const reason of ["", "   ", "short"]) {
      const response = await handleUpdateModelRouteRequest(
        new Request("http://localhost/api/admin/model-routes/route-1", {
          method: "POST",
          body: JSON.stringify({
            status: "active",
            reason,
          }),
        }),
        { params: { id: "route-1" } },
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
