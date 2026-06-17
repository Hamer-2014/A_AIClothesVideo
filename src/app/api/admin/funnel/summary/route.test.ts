import { describe, expect, it } from "vitest";

import { handleGetAdminFunnelSummaryRequest } from "./route";

describe("GET /api/admin/funnel/summary", () => {
  it("requires admin access", async () => {
    const response = await handleGetAdminFunnelSummaryRequest(
      new Request("http://localhost/api/admin/funnel/summary"),
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("returns funnel summary for admins", async () => {
    const response = await handleGetAdminFunnelSummaryRequest(
      new Request("http://localhost/api/admin/funnel/summary"),
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
        getSummary: async () => ({
          eventCounts: [{ eventName: "job_created", count: 2 }],
          conversions: [],
          presetSummary: [],
          generatedAt: "2026-06-17T00:00:00.000Z",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      eventCounts: [{ eventName: "job_created", count: 2 }],
      conversions: [],
      presetSummary: [],
      generatedAt: "2026-06-17T00:00:00.000Z",
    });
  });
});
