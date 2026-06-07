import { describe, expect, it } from "vitest";

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

  it("creates a Creem checkout and records a local order", async () => {
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
        createCheckout: async (input) => ({
          id: "checkout_1",
          externalOrderId: input.requestId,
          checkoutUrl: "https://checkout.creem.io/checkout_1",
          raw: { id: "checkout_1" },
        }),
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
  });
});
