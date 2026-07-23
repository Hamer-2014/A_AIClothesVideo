import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseCreemWebhookEvent,
  signCreemWebhookPayloadForTest,
  verifyCreemWebhookSignature,
  WebhookSignatureError,
} from "./webhook";

const payload = JSON.stringify({
  id: "evt_1",
  eventType: "checkout.completed",
  object: {
    id: "checkout_1",
    request_id: "req_1",
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
      userId: "11111111-1111-4111-8111-111111111111",
      packageCode: "creator",
    },
  },
});

describe("Creem webhook", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifies HMAC-SHA256 signatures over the raw body", () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");
    const signature = createHmac("sha256", "whsec_test")
      .update(payload)
      .digest("hex");

    expect(verifyCreemWebhookSignature(payload, signature)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "whsec_test");

    expect(() => verifyCreemWebhookSignature(payload, "bad")).toThrow(
      WebhookSignatureError,
    );
  });

  it("provides a test signer for route tests", () => {
    expect(signCreemWebhookPayloadForTest(payload, "whsec_test")).toBe(
      createHmac("sha256", "whsec_test").update(payload).digest("hex"),
    );
  });

  it("parses checkout.completed events", () => {
    const event = parseCreemWebhookEvent(payload);

    expect(event).toEqual({
      id: "evt_1",
      type: "checkout.completed",
      externalOrderId: "req_1",
      checkoutId: "checkout_1",
      productId: "creator",
      amountCents: 2999,
      currency: "USD",
      customerEmail: "buyer@example.com",
      metadata: {
        userId: "11111111-1111-4111-8111-111111111111",
        packageCode: "creator",
      },
      raw: JSON.parse(payload),
    });
  });

  it("marks unsupported events as ignored", () => {
    const event = parseCreemWebhookEvent(
      JSON.stringify({ id: "evt_2", type: "checkout.created" }),
    );

    expect(event).toEqual({
      id: "evt_2",
      type: "checkout.created",
      ignored: true,
      raw: { id: "evt_2", type: "checkout.created" },
    });
  });
});
