import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import {
  captureReservedCredits,
  reserveCredits,
} from "@/lib/credits/ledger";
import { signCreemWebhookPayloadForTest } from "@/lib/providers/creem/webhook";
import { createInMemoryFunnelEventStore } from "@/server/analytics/funnel-events";
import {
  createCheckoutOrder,
  createInMemoryOrderStore,
} from "@/server/billing/orders";

import { handleBillingCheckoutRequest } from "../../billing/checkout/route";

import { handleCreemWebhookRequest } from "./route";

const userId = "11111111-1111-4111-8111-111111111111";

function signedRequest(payload: string, signature: string) {
  return new Request("http://localhost/api/webhooks/creem", {
    method: "POST",
    body: payload,
    headers: {
      "creem-signature": signature,
    },
  });
}

describe("POST /api/webhooks/creem", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 for invalid signatures", async () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");

    const response = await handleCreemWebhookRequest(
      signedRequest(JSON.stringify({ id: "evt_1" }), "bad"),
    );

    expect(response.status).toBe(401);
  });

  it("returns 401 for missing signatures", async () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");

    const response = await handleCreemWebhookRequest(
      new Request("http://localhost/api/webhooks/creem", {
        method: "POST",
        body: JSON.stringify({ id: "evt_missing" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("ignores unsupported events after signature verification", async () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");
    const payload = JSON.stringify({ id: "evt_2", type: "checkout.created" });
    const signature = signCreemWebhookPayloadForTest(payload, "whsec_test");

    const response = await handleCreemWebhookRequest(
      signedRequest(payload, signature),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, ignored: true });
  });

  it("credits the matching local order for checkout.completed", async () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    const funnelStore = createInMemoryFunnelEventStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "req_1",
      checkoutSnapshot: { creemProductId: "prod_creator" },
    });
    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.completed",
      object: {
        id: "checkout_1",
        request_id: "req_1",
        order: {
          id: "ord_provider_1",
          amount: 2999,
          currency: "USD",
        },
        product: {
          id: "prod_creator",
        },
        customer: {
          email: "buyer@example.com",
        },
        metadata: {
          userId,
          packageCode: "creator",
        },
      },
    });
    const signature = signCreemWebhookPayloadForTest(payload, "whsec_test");

    const response = await handleCreemWebhookRequest(
      signedRequest(payload, signature),
      {
        orderStore,
        ledgerStore,
        funnelEventStore: funnelStore,
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(ledgerStore.listLedger()).toHaveLength(1);
    expect(ledgerStore.listLedger()[0]?.amount).toBe(360);
    expect(funnelStore.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "payment_succeeded",
        source: "server",
        userId,
        metadata: {
          status: "paid",
        },
      }),
    ]);
    expect(JSON.stringify(funnelStore.listEvents())).not.toContain(
      "buyer@example.com",
    );
  });

  it("does not grant credits twice for replayed paid webhook events", async () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("CREEM_PRODUCT_ID_STARTER", "prod_starter");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "starter",
      externalOrderId: "req_replay",
      checkoutSnapshot: { creemProductId: "prod_starter" },
    });
    const payload = JSON.stringify({
      id: "evt_replay",
      type: "checkout.completed",
      object: {
        id: "checkout_replay",
        request_id: "req_replay",
        order: {
          id: "ord_provider_replay",
          amount: 999,
          currency: "USD",
        },
        product: {
          id: "prod_starter",
        },
        metadata: {
          userId,
          packageCode: "starter",
        },
      },
    });
    const signature = signCreemWebhookPayloadForTest(payload, "whsec_test");

    await handleCreemWebhookRequest(signedRequest(payload, signature), {
      orderStore,
      ledgerStore,
    });
    await handleCreemWebhookRequest(signedRequest(payload, signature), {
      orderStore,
      ledgerStore,
    });

    expect(ledgerStore.listLedger()).toHaveLength(1);
    expect(ledgerStore.listLedger()[0]?.amount).toBe(100);
  });

  it("credits an order created at checkout when Creem returns a distinct provider order id after product configuration changes", async () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("CREEM_PURCHASES_ENABLED", "true");
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator_at_checkout");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();

    const checkoutResponse = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packageCode: "creator" }),
      }),
      {
        getSession: async () => ({ user: { id: userId } }),
        orderStore,
        createCheckout: async (input) => ({
          id: "checkout_2",
          externalOrderId: input.requestId,
          checkoutUrl: "https://checkout.creem.io/checkout_2",
          raw: { id: "checkout_2" },
        }),
        funnelEventStore: createInMemoryFunnelEventStore(),
      },
    );

    expect(checkoutResponse.status).toBe(200);
    const order = orderStore.listOrders()[0];
    expect(order).toBeDefined();
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator_rotated");
    const payload = JSON.stringify({
      id: "evt_checkout_to_webhook",
      type: "checkout.completed",
      object: {
        id: "checkout_2",
        request_id: order?.externalOrderId,
        order: {
          id: "ord_provider_2",
          amount: 2999,
          currency: "USD",
        },
        product: { id: "prod_creator_at_checkout" },
        metadata: { userId, packageCode: "creator" },
      },
    });
    const signature = signCreemWebhookPayloadForTest(payload, "whsec_test");

    const webhookResponse = await handleCreemWebhookRequest(
      signedRequest(payload, signature),
      { orderStore, ledgerStore },
    );

    expect(webhookResponse.status).toBe(200);
    expect(ledgerStore.listLedger()).toHaveLength(1);
    expect(orderStore.listOrders()[0]).toMatchObject({ status: "paid" });
  });

  it("reverses spent credits once for a replayed successful full refund", async () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "starter",
      externalOrderId: "req_refund",
      checkoutSnapshot: { creemProductId: "prod_starter" },
    });

    const paidPayload = JSON.stringify({
      id: "evt_paid_refund",
      eventType: "checkout.completed",
      object: {
        id: "checkout_refund",
        request_id: "req_refund",
        order: { amount: 999, currency: "USD" },
        product: { id: "prod_starter" },
        metadata: { userId, packageCode: "starter" },
      },
    });
    await handleCreemWebhookRequest(
      signedRequest(
        paidPayload,
        signCreemWebhookPayloadForTest(paidPayload, "whsec_test"),
      ),
      { orderStore, ledgerStore },
    );
    await reserveCredits({
      store: ledgerStore,
      userId,
      amount: 100,
      reason: "generation",
      idempotencyKey: "reserve:refund-route",
    });
    await captureReservedCredits({
      store: ledgerStore,
      userId,
      amount: 100,
      reason: "delivered generation",
      idempotencyKey: "capture:refund-route",
    });

    const refundPayload = JSON.stringify({
      id: "evt_refund_route",
      eventType: "refund.created",
      object: {
        id: "ref_route",
        status: "succeeded",
        refund_amount: 1199,
        refund_currency: "USD",
        transaction: {
          status: "refunded",
          amount_paid: 1199,
          refunded_amount: 1199,
          currency: "USD",
        },
        checkout: {
          request_id: "req_refund",
          metadata: { userId, packageCode: "starter" },
        },
        order: { product: "prod_starter", amount: 999, currency: "USD" },
      },
    });
    const signature = signCreemWebhookPayloadForTest(
      refundPayload,
      "whsec_test",
    );

    const first = await handleCreemWebhookRequest(
      signedRequest(refundPayload, signature),
      { orderStore, ledgerStore },
    );
    const replay = await handleCreemWebhookRequest(
      signedRequest(refundPayload, signature),
      { orderStore, ledgerStore },
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(orderStore.listOrders()[0]?.status).toBe("refunded");
    expect(
      ledgerStore.listLedger().filter((entry) => entry.type === "purchase_reversal"),
    ).toEqual([expect.objectContaining({ amount: -100, balanceAfter: -100 })]);
  });
});
