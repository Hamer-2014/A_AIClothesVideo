import { describe, expect, it } from "vitest";

import { createInMemoryCreditLedgerStore } from "./memory-store";
import {
  adjustCredits,
  captureReservedCredits,
  grantTrialCredits,
  purchaseCredits,
  reversePurchasedCredits,
  refundCredits,
  releaseReservedCredits,
  reserveCredits,
} from "./ledger";

const userId = "11111111-1111-4111-8111-111111111111";

describe("credit ledger service", () => {
  it("applies purchase credits once for the same idempotency key", async () => {
    const store = createInMemoryCreditLedgerStore();

    const first = await purchaseCredits({
      store,
      userId,
      amount: 100,
      reason: "Creator package",
      idempotencyKey: "purchase:event-1",
    });
    const second = await purchaseCredits({
      store,
      userId,
      amount: 100,
      reason: "Creator package replay",
      idempotencyKey: "purchase:event-1",
    });

    expect(first.ledger.id).toBe(second.ledger.id);
    expect(second.wallet.availableBalance).toBe(100);
    expect(store.listLedger()).toHaveLength(1);
  });

  it("reverses purchased credits once and allows a negative balance", async () => {
    const store = createInMemoryCreditLedgerStore();
    await purchaseCredits({
      store,
      userId,
      amount: 100,
      reason: "Starter package",
      idempotencyKey: "purchase:event-refund",
    });
    await reserveCredits({
      store,
      userId,
      amount: 100,
      reason: "generation",
      idempotencyKey: "reserve:event-refund",
    });
    await captureReservedCredits({
      store,
      userId,
      amount: 100,
      reason: "delivered generation",
      idempotencyKey: "capture:event-refund",
    });

    const first = await reversePurchasedCredits({
      store,
      userId,
      amount: 100,
      reason: "Creem refund starter",
      idempotencyKey: "purchase-refund:creem:order:req_1",
    });
    const replay = await reversePurchasedCredits({
      store,
      userId,
      amount: 100,
      reason: "Creem refund starter replay",
      idempotencyKey: "purchase-refund:creem:order:req_1",
    });

    expect(first.wallet.availableBalance).toBe(-100);
    expect(first.wallet.totalPurchased).toBe(100);
    expect(replay.wallet.availableBalance).toBe(-100);
    expect(replay.idempotent).toBe(true);
    expect(
      store.listLedger().filter((entry) => entry.type === "purchase_reversal"),
    ).toEqual([
      expect.objectContaining({
        amount: -100,
        balanceBefore: 0,
        balanceAfter: -100,
      }),
    ]);
  });

  it("reserves, captures, and releases credits without changing history", async () => {
    const store = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store,
      userId,
      amount: 100,
      reason: "first verified login",
      idempotencyKey: "trial:user-1",
    });

    const reserved = await reserveCredits({
      store,
      userId,
      amount: 70,
      relatedJobId: "22222222-2222-4222-8222-222222222222",
      reason: "8s video generation",
      idempotencyKey: "reserve:job-1",
    });
    expect(reserved.wallet.availableBalance).toBe(30);
    expect(reserved.wallet.reservedBalance).toBe(70);

    const captured = await captureReservedCredits({
      store,
      userId,
      amount: 50,
      relatedJobId: "22222222-2222-4222-8222-222222222222",
      reason: "post qa passed",
      idempotencyKey: "capture:job-1:partial",
    });
    expect(captured.wallet.availableBalance).toBe(30);
    expect(captured.wallet.reservedBalance).toBe(20);
    expect(captured.wallet.totalCaptured).toBe(50);

    const released = await releaseReservedCredits({
      store,
      userId,
      amount: 20,
      relatedJobId: "22222222-2222-4222-8222-222222222222",
      reason: "unused strict qa delta",
      idempotencyKey: "release:job-1:rest",
    });
    expect(released.wallet.availableBalance).toBe(50);
    expect(released.wallet.reservedBalance).toBe(0);
  });

  it("rejects reserve and capture operations that exceed wallet balances", async () => {
    const store = createInMemoryCreditLedgerStore();

    await expect(
      reserveCredits({
        store,
        userId,
        amount: 70,
        reason: "no funds",
        idempotencyKey: "reserve:job-2",
      }),
    ).rejects.toThrow("Insufficient available credits.");

    await grantTrialCredits({
      store,
      userId,
      amount: 30,
      reason: "verified login",
      idempotencyKey: "trial:user-2",
    });

    await expect(
      captureReservedCredits({
        store,
        userId,
        amount: 40,
        reason: "no reservation",
        idempotencyKey: "capture:job-2",
      }),
    ).rejects.toThrow("Insufficient reserved credits.");
  });

  it("requires a reason for admin adjustments and supports refunds", async () => {
    const store = createInMemoryCreditLedgerStore();

    await expect(
      adjustCredits({
        store,
        userId,
        amount: 10,
        reason: "",
        idempotencyKey: "admin:user-1",
      }),
    ).rejects.toThrow("A reason is required for credit ledger entries.");

    await adjustCredits({
      store,
      userId,
      amount: 10,
      reason: "manual goodwill adjustment",
      idempotencyKey: "admin:user-1",
    });
    const refunded = await refundCredits({
      store,
      userId,
      amount: 5,
      reason: "system could not deliver",
      idempotencyKey: "refund:job-1",
    });

    expect(refunded.wallet.availableBalance).toBe(15);
    expect(store.listLedger().map((entry) => entry.type)).toEqual([
      "admin_adjust",
      "refund",
    ]);
  });
});
