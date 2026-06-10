import { describe, expect, it } from "vitest";

import { handleGetBillingOverviewRequest } from "./route";

describe("GET /api/billing/overview", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleGetBillingOverviewRequest(
      new Request("http://localhost/api/billing/overview"),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns the current user's billing overview", async () => {
    const response = await handleGetBillingOverviewRequest(
      new Request("http://localhost/api/billing/overview"),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        getOverview: async ({ userId }) => ({
          wallet: { userId, availableBalance: 220 },
          orders: [],
          ledger: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      wallet: { userId: "user-1", availableBalance: 220 },
      orders: [],
      ledger: [],
    });
  });
});
