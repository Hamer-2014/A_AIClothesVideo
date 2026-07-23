import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CreemCheckoutError,
  CreemUnavailableError,
} from "@/lib/providers/creem/client";
import { createInMemoryFunnelEventStore } from "@/server/analytics/funnel-events";
import { createInMemoryOrderStore } from "@/server/billing/orders";

import { handleBillingCheckoutRequest } from "./route";

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.stubEnv("CREEM_PURCHASES_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("rejects a client-supplied Creem product ID", async () => {
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          packageCode: "starter",
          productId: "prod_attacker",
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

  it.each(["", "null", "[]", "not-json"])(
    "returns 400 for malformed checkout body %s",
    async (body) => {
      const response = await handleBillingCheckoutRequest(
        new Request("http://localhost/api/billing/checkout", {
          method: "POST",
          body,
        }),
        {
          getSession: async () => ({ user: { id: "user-1" } }),
        },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "invalid_checkout_request",
      });
    },
  );

  it("does not create an order while production purchases are disabled", async () => {
    vi.stubEnv("CREEM_PURCHASES_ENABLED", "false");
    vi.stubEnv("CREEM_PRODUCT_ID_STARTER", "prod_starter");
    const orderStore = createInMemoryOrderStore();
    const createCheckout = vi.fn();

    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packageCode: "starter" }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        orderStore,
        createCheckout,
      },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "billing_disabled" });
    expect(orderStore.listOrders()).toHaveLength(0);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("creates a Creem checkout and records a local order", async () => {
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator");
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
        createCheckout: async (input) => {
          expect(input.productId).toBe("prod_creator");
          expect(orderStore.listOrders()).toHaveLength(1);
          expect(orderStore.listOrders()[0]).toMatchObject({
            externalOrderId: input.requestId,
            status: "created",
            checkoutSnapshot: { creemProductId: "prod_creator" },
          });
          expect(input.successUrl).toBe(
            `http://localhost:3000/billing/success?order=${input.requestId}`,
          );
          return {
            id: "checkout_1",
            externalOrderId: input.requestId,
            checkoutUrl: "https://checkout.creem.io/checkout_1",
            raw: { id: "checkout_1", api_key: "provider_secret" },
          };
        },
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
      checkoutSnapshot: {
        creemProductId: "prod_creator",
        provider: { id: "checkout_1" },
      },
    });
    expect(JSON.stringify(orderStore.listOrders()[0]?.checkoutSnapshot)).not.toContain(
      "provider_secret",
    );
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
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator");
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
    expect(orderStore.listOrders()).toHaveLength(1);
    expect(orderStore.listOrders()[0]?.status).toBe("failed");
  });

  it("maps Creem checkout failures to a safe 502 response", async () => {
    vi.stubEnv("CREEM_PRODUCT_ID_CREATOR", "prod_creator");
    const orderStore = createInMemoryOrderStore();
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packageCode: "creator" }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        orderStore,
        createCheckout: async () => {
          throw new CreemCheckoutError(400);
        },
      },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "billing_provider_error" });
    expect(orderStore.listOrders()[0]?.status).toBe("failed");
  });

  it("fails closed without a configured Creem product ID and does not create checkout", async () => {
    const createCheckout = vi.fn();
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ packageCode: "starter" }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createCheckout,
      },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "billing_not_configured" });
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
