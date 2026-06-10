import { describe, expect, it } from "vitest";

import {
  createInMemoryUserBillingStore,
  getUserBillingOverview,
} from "./user-billing";

describe("getUserBillingOverview", () => {
  it("returns wallet, orders, and ledger entries for the current user", async () => {
    const overview = await getUserBillingOverview({
      store: createInMemoryUserBillingStore({
        wallets: [
          {
            id: "wallet-1",
            userId: "user-1",
            availableBalance: 220,
            reservedBalance: 70,
            totalPurchased: 360,
            totalGranted: 0,
            totalCaptured: 130,
          },
        ],
        orders: [
          {
            id: "order-1",
            userId: "user-1",
            status: "paid",
            provider: "creem",
            productCode: "creator",
            amountCents: 2999,
            currency: "USD",
            creditsGranted: 360,
            createdAt: new Date("2026-06-08T00:00:00.000Z"),
          },
        ],
        ledger: [
          {
            id: "ledger-1",
            userId: "user-1",
            type: "purchase",
            amount: 360,
            relatedJobId: null,
            relatedOrderId: "order-1",
            reason: "Creem purchase creator",
            createdAt: new Date("2026-06-08T00:00:10.000Z"),
          },
          {
            id: "ledger-2",
            userId: "user-2",
            type: "purchase",
            amount: 100,
            relatedJobId: null,
            relatedOrderId: "order-2",
            reason: "other user",
            createdAt: new Date("2026-06-09T00:00:10.000Z"),
          },
        ],
      }),
      userId: "user-1",
    });

    expect(overview).toEqual({
      wallet: expect.objectContaining({ id: "wallet-1", availableBalance: 220 }),
      orders: [expect.objectContaining({ id: "order-1", productCode: "creator" })],
      ledger: [expect.objectContaining({ id: "ledger-1", type: "purchase" })],
    });
  });
});
