import { describe, expect, it } from "vitest";

import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";

import { createInMemoryAdminAuditStore } from "./audit";
import {
  adjustUserCreditsByAdmin,
  createInMemoryBillingOpsStore,
  getBillingOpsOverview,
} from "./billing";

const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  role: "admin" as const,
};

describe("billing ops", () => {
  it("returns wallets, orders, and ledger entries for admin views", async () => {
    const overview = await getBillingOpsOverview({
      store: createInMemoryBillingOpsStore({
        wallets: [
          {
            id: "wallet-1",
            userId: "user-1",
            availableBalance: 100,
            reservedBalance: 30,
            totalPurchased: 100,
            totalGranted: 0,
            totalCaptured: 0,
          },
        ],
        orders: [
          {
            id: "order-1",
            userId: "user-1",
            status: "paid",
            provider: "creem",
            productCode: "starter",
            amountCents: 999,
            currency: "USD",
            creditsGranted: 100,
            createdAt: new Date("2026-06-07T00:00:00.000Z"),
          },
        ],
        ledger: [
          {
            id: "ledger-1",
            userId: "user-1",
            type: "purchase",
            amount: 100,
            relatedJobId: null,
            relatedOrderId: "order-1",
            reason: "purchase",
            createdAt: new Date("2026-06-07T00:00:00.000Z"),
          },
        ],
      }),
      userId: "user-1",
    });

    expect(overview).toEqual({
      wallets: [expect.objectContaining({ id: "wallet-1" })],
      orders: [expect.objectContaining({ id: "order-1" })],
      ledger: [expect.objectContaining({ id: "ledger-1" })],
    });
  });

  it("adds admin adjustment credits through ledger and writes audit log", async () => {
    const ledgerStore = createInMemoryCreditLedgerStore();
    const auditStore = createInMemoryAdminAuditStore();

    const result = await adjustUserCreditsByAdmin({
      ledgerStore,
      auditStore,
      actor,
      targetUserId: "user-1",
      amount: 25,
      reason: "manual compensation",
    });

    expect(result.ledger).toMatchObject({
      userId: "user-1",
      type: "admin_adjust",
      amount: 25,
      reason: "manual compensation",
    });
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "credits:admin_adjust",
      targetType: "user",
      reason: "manual compensation",
    });
  });

  it("rejects admin credit adjustment when reason is too short", async () => {
    await expect(
      adjustUserCreditsByAdmin({
        ledgerStore: createInMemoryCreditLedgerStore(),
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        targetUserId: "user-1",
        amount: 25,
        reason: "short",
      }),
    ).rejects.toThrow("Admin action reason must be at least 6 characters.");
  });
});
