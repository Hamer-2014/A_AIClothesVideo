import { describe, expect, it } from "vitest";

import { handleGetBillingRequest } from "./route";

describe("GET /api/admin/billing", () => {
  it("requires admin access", async () => {
    const response = await handleGetBillingRequest(
      new Request("http://localhost/api/admin/billing"),
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("returns billing overview", async () => {
    const response = await handleGetBillingRequest(
      new Request("http://localhost/api/admin/billing?userId=user-1"),
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
        getOverview: async (input) => ({
          wallets: [{ userId: input.userId, availableBalance: 100 }],
          orders: [],
          ledger: [],
          creditPackages: [{ code: "starter", credits: 100 }],
          pricingSource: "code",
          creemVerificationStatus: "pending_creem_approval",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      wallets: [{ userId: "user-1", availableBalance: 100 }],
      orders: [],
      ledger: [],
      creditPackages: [{ code: "starter", credits: 100 }],
      pricingSource: "code",
      creemVerificationStatus: "pending_creem_approval",
    });
  });
});
