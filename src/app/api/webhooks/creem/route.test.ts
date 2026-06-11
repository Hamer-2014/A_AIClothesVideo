import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { signCreemWebhookPayloadForTest } from "@/lib/providers/creem/webhook";
import {
  createCheckoutOrder,
  createInMemoryOrderStore,
} from "@/server/billing/orders";

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
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "creator",
      externalOrderId: "ord_1",
    });
    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.completed",
      object: {
        id: "checkout_1",
        order: {
          id: "ord_1",
          amount: 2999,
          currency: "USD",
        },
        product: {
          id: "creator",
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
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(ledgerStore.listLedger()).toHaveLength(1);
    expect(ledgerStore.listLedger()[0]?.amount).toBe(360);
  });

  it("does not grant credits twice for replayed paid webhook events", async () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");
    const orderStore = createInMemoryOrderStore();
    const ledgerStore = createInMemoryCreditLedgerStore();
    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: "starter",
      externalOrderId: "ord_replay",
    });
    const payload = JSON.stringify({
      id: "evt_replay",
      type: "checkout.completed",
      object: {
        id: "checkout_replay",
        order: {
          id: "ord_replay",
          amount: 999,
          currency: "USD",
        },
        product: {
          id: "starter",
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
});
