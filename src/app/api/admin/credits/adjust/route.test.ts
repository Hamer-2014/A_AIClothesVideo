import { describe, expect, it } from "vitest";

import { handleAdjustCreditsRequest } from "./route";

describe("POST /api/admin/credits/adjust", () => {
  it("requires admin access", async () => {
    const response = await handleAdjustCreditsRequest(
      new Request("http://localhost/api/admin/credits/adjust", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          amount: 25,
          reason: "compensation",
        }),
      }),
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("adjusts credits for admins", async () => {
    const response = await handleAdjustCreditsRequest(
      new Request("http://localhost/api/admin/credits/adjust", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          amount: 25,
          reason: "compensation",
        }),
      }),
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
        adjustCredits: async (input) => ({
          ledger: {
            userId: input.targetUserId,
            amount: input.amount,
            reason: input.reason,
          },
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ledger: {
        userId: "user-1",
        amount: 25,
        reason: "compensation",
      },
    });
  });
});
