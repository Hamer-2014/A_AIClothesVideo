import { describe, expect, it } from "vitest";

import { CreemUnavailableError } from "@/lib/providers/creem/client";
import { createInMemoryFunnelEventStore } from "@/server/analytics/funnel-events";
import { createInMemoryOrderStore } from "@/server/billing/orders";

import { handleBillingCheckoutRequest } from "./route";

describe("POST /api/billing/checkout", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packageCode: "creator" }),
      }),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for unknown package codes", async () => {
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packageCode: "vip" }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("rejects arbitrary amount and credits from client input", async () => {
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          packageCode: "starter",
          amountCents: 1,
          credits: 999999,
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "client_price_fields_not_allowed",
    });
  });

  it("creates a Creem checkout and records a local order", async () => {
    const orderStore = createInMemoryOrderStore();
    const funnelStore = createInMemoryFunnelEventStore();
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packageCode: "creator" }),
      }),
      {
        getSession: async () => ({
          user: { id: "11111111-1111-4111-8111-111111111111" },
        }),
        orderStore,
        createCheckout: async (input) => ({
          id: "checkout_1",
          externalOrderId: input.requestId,
          checkoutUrl: "https://checkout.creem.io/checkout_1",
          raw: { id: "checkout_1" },
        }),
        funnelEventStore: funnelStore,
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checkoutUrl).toBe("https://checkout.creem.io/checkout_1");
    expect(orderStore.listOrders()).toHaveLength(1);
    expect(orderStore.listOrders()[0]).toMatchObject({
      userId: "11111111-1111-4111-8111-111111111111",
      productCode: "creator",
      externalOrderId: expect.any(String),
      status: "created",
    });
    expect(funnelStore.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "checkout_started",
        source: "server",
        userId: "11111111-1111-4111-8111-111111111111",
        metadata: expect.objectContaining({
          sourcePage: "billing",
          status: "created",
        }),
      }),
    ]);
    expect(JSON.stringify(funnelStore.listEvents())).not.toContain(
      "https://checkout.creem.io",
    );
  });

  it("fails closed when the Creem checkout provider is unavailable", async () => {
    const orderStore = createInMemoryOrderStore();
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packageCode: "creator" }),
      }),
      {
        getSession: async () => ({
          user: { id: "11111111-1111-4111-8111-111111111111" },
        }),
        orderStore,
        createCheckout: async () => {
          throw new CreemUnavailableError();
        },
      },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "billing_provider_unavailable",
    });
    expect(orderStore.listOrders()).toHaveLength(0);
  });
});
