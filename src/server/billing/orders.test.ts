import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";

import {
  createCheckoutOrder,
  createInMemoryOrderStore,
  handleCreemCheckoutCompleted,
} from "./orders";

const userId = "11111111-1111-4111-8111-111111111111";

function completedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "checkout.completed" as const,
    externalOrderId: "ord_1",
    checkoutId: "checkout_1",
    productId: "creator",
    amountCents: 2999,
    currency: "USD",
    customerEmail: "buyer@example.com",
    metadata: {
      userId,
      packageCode: "creator",
    },
    raw: { id: "evt_1" },
    ...overrides,
  };
}

describe("billing orders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a local checkout order before redirecting to Creem", async () => {
    const orderStore = createInMemoryOrderStore();

    const order = await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "ord_1",
      checkoutSnapshot: { checkoutId: "checkout_1" },
    });

    expect(order).toMatchObject({
      userId,
      status: "created",
      externalOrderId: "ord_1",
      productCode: "creator",
      amountCents: 2999,
      currency: "USD",
      creditsGranted: 360,
    });
  });

  it("credits a paid Creem order once even when the webhook is replayed", async () => {
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "ord_1",
      checkoutSnapshot: { checkoutId: "checkout_1" },
    });

    const first = await handleCreemCheckoutCompleted({
      orderStore,
      ledgerStore,
      event: completedEvent({ productId: "prod_creator" }),
    });
    const second = await handleCreemCheckoutCompleted({
      orderStore,
      ledgerStore,
      event: completedEvent({ id: "evt_1_replay", productId: "prod_creator" }),
    });

    expect(first.ledgerResult.idempotent).toBe(false);
    expect(second.ledgerResult.idempotent).toBe(true);
    expect(second.order.status).toBe("paid");
    expect(second.ledgerResult.wallet.availableBalance).toBe(360);
    expect(ledgerStore.listLedger()).toHaveLength(1);
  });

  it("rejects product, amount, currency, and user mismatches", async () => {
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "ord_1",
      checkoutSnapshot: { checkoutId: "checkout_1" },
    });

    await expect(
      handleCreemCheckoutCompleted({
        orderStore,
        ledgerStore,
        event: completedEvent({ productId: "prod_creator", amountCents: 999 }),
      }),
    ).rejects.toThrow("Creem paid event does not match the local order.");

    await expect(
      handleCreemCheckoutCompleted({
        orderStore,
        ledgerStore,
        event: completedEvent({
          productId: "prod_creator",
          metadata: {
            userId: "33333333-3333-4333-8333-333333333333",
            packageCode: "creator",
          },
        }),
      }),
    ).rejects.toThrow("Creem paid event user does not match the local order.");
  });

  it("accepts the configured Creem product ID rather than the local package code", async () => {
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "ord_1",
    });

    await expect(
      handleCreemCheckoutCompleted({
        orderStore,
        ledgerStore,
        event: completedEvent({ productId: "prod_creator" }),
      }),
    ).resolves.toMatchObject({ order: { status: "paid" } });
  });
});
