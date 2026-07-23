import { describe, expect, it } from "vitest";

import {
  createCheckoutOrder,
  createInMemoryOrderStore,
} from "@/server/billing/orders";

import { handleGetBillingOrderRequest } from "./route";

describe("GET /api/billing/orders/[externalOrderId]", () => {
  it("returns 401 without a session", async () => {
    const response = await handleGetBillingOrderRequest("req_1", {
      getSession: async () => null,
      orderStore: createInMemoryOrderStore(),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 for another user's order", async () => {
    const orderStore = createInMemoryOrderStore();
    await createCheckoutOrder({
      store: orderStore,
      userId: "owner-1",
      packageCode: "starter",
      externalOrderId: "req_private",
    });

    const response = await handleGetBillingOrderRequest("req_private", {
      getSession: async () => ({ user: { id: "attacker-1" } }),
      orderStore,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "order_not_found" });
  });

  it("returns only the owner's public payment status", async () => {
    const orderStore = createInMemoryOrderStore();
    await createCheckoutOrder({
      store: orderStore,
      userId: "owner-1",
      packageCode: "starter",
      externalOrderId: "req_1",
    });
    await orderStore.markOrderPaid("req_1", {
      status: "paid",
      webhookEventId: "evt_1",
      webhookSnapshot: { secret: "must-not-leak" },
    });

    const response = await handleGetBillingOrderRequest("req_1", {
      getSession: async () => ({ user: { id: "owner-1" } }),
      orderStore,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "paid",
      packageCode: "starter",
      creditsGranted: 100,
    });
  });
});
