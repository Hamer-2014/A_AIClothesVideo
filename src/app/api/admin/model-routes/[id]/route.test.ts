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

  it("updates model route", async () => {
    const response = await handleUpdateModelRouteRequest(
      new Request("http://localhost/api/admin/model-routes/route-1", {
        method: "POST",
        body: JSON.stringify({
          status: "active",
          primaryModel: "veo3.1-pro-beta",
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
        updateRoute: async (input) => ({
          id: input.routeId,
          status: input.status,
          primaryModel: input.primaryModel,
          minMarginPercent: input.minMarginPercent,
          allowPublicFallback: input.allowPublicFallback,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "route-1",
      status: "active",
      primaryModel: "veo3.1-pro-beta",
      minMarginPercent: 50,
      allowPublicFallback: false,
    });
  });
});
