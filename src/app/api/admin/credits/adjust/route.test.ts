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
    const receivedInputs: unknown[] = [];
    const response = await handleAdjustCreditsRequest(
      new Request("http://localhost/api/admin/credits/adjust", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          amount: 25,
          reason: "compensation",
          idempotencyKey: "admin_adjust:user-1:job-1:compensation",
          relatedJobId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
        adjustCredits: async (input) => {
          receivedInputs.push(input);
          return {
            ledger: {
              userId: input.targetUserId,
              amount: input.amount,
              reason: input.reason,
            },
          };
        },
      },
    );

    expect(response.status).toBe(200);
    expect(receivedInputs).toEqual([
      expect.objectContaining({
        idempotencyKey: "admin_adjust:user-1:job-1:compensation",
        relatedJobId: "33333333-3333-4333-8333-333333333333",
      }),
    ]);
    expect(await response.json()).toEqual({
      ledger: {
        userId: "user-1",
        amount: 25,
        reason: "compensation",
      },
    });
  });

  it("returns the service error message for failed adjustments", async () => {
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
        adjustCredits: async () => {
          throw new Error("Failed to create admin audit log.");
        },
      },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "credit_adjust_failed",
      message: "Failed to create admin audit log.",
    });
  });

  it("rejects missing, whitespace-only, and short reasons", async () => {
    for (const reason of ["", "   ", "short"]) {
      const response = await handleAdjustCreditsRequest(
        new Request("http://localhost/api/admin/credits/adjust", {
          method: "POST",
          body: JSON.stringify({
            userId: "user-1",
            amount: 25,
            reason,
          }),
        }),
        {
          getAdminSession: async () => ({
            userId: "admin-1",
            email: "admin@example.com",
            role: "admin",
          }),
        },
      );

      expect(response.status).toBe(400);
    }
  });
});
