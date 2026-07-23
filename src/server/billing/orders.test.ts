import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";

import {
  createCheckoutOrder,
  createInMemoryOrderStore,
  handleCreemCheckoutCompleted,
  handleCreemRefundCreated,
} from "./orders";

const userId = "11111111-1111-4111-8111-111111111111";

function completedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "checkout.completed" as const,
    externalOrderId: "req_1",
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

function refundEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_refund_1",
    type: "refund.created" as const,
    refundId: "ref_1",
    externalOrderId: "req_1",
    productId: "prod_creator",
    amountCents: 2999,
    currency: "USD",
    transactionStatus: "refunded" as const,
    metadata: { userId, packageCode: "creator" },
    raw: { id: "evt_refund_1", object: { id: "ref_1" } },
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
      externalOrderId: "req_1",
      checkoutSnapshot: { creemProductId: "prod_creator" },
    });

    expect(order).toMatchObject({
      userId,
      status: "created",
      externalOrderId: "req_1",
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
      externalOrderId: "req_1",
      checkoutSnapshot: { creemProductId: "prod_creator" },
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
      externalOrderId: "req_1",
      checkoutSnapshot: { creemProductId: "prod_creator" },
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
      externalOrderId: "req_1",
      checkoutSnapshot: { creemProductId: "prod_creator" },
    });

    await expect(
      handleCreemCheckoutCompleted({
        orderStore,
        ledgerStore,
        event: completedEvent({ productId: "prod_creator" }),
      }),
    ).resolves.toMatchObject({ order: { status: "paid" } });
  });

  it("fails closed when the checkout snapshot lacks the Creem product ID", async () => {
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "req_missing_snapshot",
    });

    await expect(
      handleCreemCheckoutCompleted({
        orderStore,
        ledgerStore,
        event: completedEvent({
          externalOrderId: "req_missing_snapshot",
          productId: "prod_creator",
        }),
      }),
    ).rejects.toThrow("Creem checkout product snapshot is missing.");
  });

  it("reverses a paid order once and rejects a different second refund", async () => {
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "req_1",
      checkoutSnapshot: { creemProductId: "prod_creator" },
    });
    await handleCreemCheckoutCompleted({
      orderStore,
      ledgerStore,
      event: completedEvent({ productId: "prod_creator" }),
    });

    const first = await handleCreemRefundCreated({
      orderStore,
      ledgerStore,
      event: refundEvent(),
    });
    const replay = await handleCreemRefundCreated({
      orderStore,
      ledgerStore,
      event: refundEvent(),
    });

    expect(first.order.status).toBe("refunded");
    expect(first.ledgerResult.wallet.availableBalance).toBe(0);
    expect(replay.ledgerResult.idempotent).toBe(true);
    expect(
      ledgerStore.listLedger().filter((entry) => entry.type === "purchase_reversal"),
    ).toHaveLength(1);

    await expect(
      handleCreemRefundCreated({
        orderStore,
        ledgerStore,
        event: refundEvent({
          id: "evt_refund_2",
          refundId: "ref_2",
          raw: { id: "evt_refund_2", object: { id: "ref_2" } },
        }),
      }),
    ).rejects.toThrow("Creem order has already been refunded.");
  });

  it("rejects refunds that do not match a paid local order", async () => {
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "req_1",
      checkoutSnapshot: { creemProductId: "prod_creator" },
    });

    await expect(
      handleCreemRefundCreated({ orderStore, ledgerStore, event: refundEvent() }),
    ).rejects.toThrow("Creem refund requires a paid local order.");
    expect(ledgerStore.listLedger()).toHaveLength(0);
    expect(orderStore.listOrders()[0]?.status).toBe("created");
  });
});
