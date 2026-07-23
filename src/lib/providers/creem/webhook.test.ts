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

  it("parses a successful full refund.created event", () => {
    const refundPayload = JSON.stringify({
      id: "evt_refund_1",
      eventType: "refund.created",
      object: {
        id: "ref_1",
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
          request_id: "req_refund_1",
          metadata: { userId: "user-1", packageCode: "starter" },
        },
        order: {
          product: "prod_starter",
          amount: 999,
          currency: "USD",
        },
      },
    });

    expect(parseCreemWebhookEvent(refundPayload)).toEqual({
      id: "evt_refund_1",
      type: "refund.created",
      refundId: "ref_1",
      externalOrderId: "req_refund_1",
      productId: "prod_starter",
      amountCents: 999,
      currency: "USD",
      transactionStatus: "refunded",
      metadata: { userId: "user-1", packageCode: "starter" },
      raw: JSON.parse(refundPayload),
    });
  });

  it.each([
    {
      name: "partial",
      objectStatus: "succeeded",
      transactionStatus: "partially_refunded",
      refundAmount: 500,
      amountPaid: 1199,
      refundedAmount: 500,
    },
    {
      name: "not succeeded",
      objectStatus: "processing",
      transactionStatus: "refunded",
      refundAmount: 1199,
      amountPaid: 1199,
      refundedAmount: 1199,
    },
  ])("rejects $name refund events", (scenario) => {
    const refundPayload = JSON.stringify({
      id: "evt_refund_invalid",
      eventType: "refund.created",
      object: {
        id: "ref_invalid",
        status: scenario.objectStatus,
        refund_amount: scenario.refundAmount,
        refund_currency: "USD",
        transaction: {
          status: scenario.transactionStatus,
          amount_paid: scenario.amountPaid,
          refunded_amount: scenario.refundedAmount,
          currency: "USD",
        },
        checkout: {
          request_id: "req_refund_invalid",
          metadata: { userId: "user-1", packageCode: "starter" },
        },
        order: { product: "prod_starter", amount: 999, currency: "USD" },
      },
    });

    expect(() => parseCreemWebhookEvent(refundPayload)).toThrow(
      "Creem refund.created event is not a successful full refund.",
    );
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
