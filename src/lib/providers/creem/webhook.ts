import { createHmac, timingSafeEqual } from "node:crypto";

import type { JsonValue } from "@/lib/db/schema/common";

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid Creem webhook signature.") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export interface CreemCheckoutCompletedEvent {
  id: string;
  type: "checkout.completed";
  externalOrderId: string;
  checkoutId: string;
  productId: string;
  amountCents: number;
  currency: string;
  customerEmail: string | null;
  metadata: Record<string, JsonValue>;
  raw: JsonValue;
}

export interface CreemRefundCreatedEvent {
  id: string;
  type: "refund.created";
  refundId: string;
  externalOrderId: string;
  productId: string;
  amountCents: number;
  currency: string;
  transactionStatus: "refunded";
  metadata: Record<string, JsonValue>;
  raw: JsonValue;
}

export interface IgnoredCreemWebhookEvent {
  id: string;
  type: string;
  ignored: true;
  raw: JsonValue;
}

export type ParsedCreemWebhookEvent =
  | CreemCheckoutCompletedEvent
  | CreemRefundCreatedEvent
  | IgnoredCreemWebhookEvent;

function getWebhookSecret() {
  const secret = process.env.CREEM_WEBHOOK_SECRET;

  if (!secret) {
    throw new WebhookSignatureError("CREEM_WEBHOOK_SECRET is not configured.");
  }

  return secret;
}

function hmacSha256(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signCreemWebhookPayloadForTest(payload: string, secret: string) {
  return hmacSha256(payload, secret);
}

export function verifyCreemWebhookSignature(
  rawBody: string,
  signature: string | null,
) {
  if (!signature) {
    throw new WebhookSignatureError();
  }

  const expected = hmacSha256(rawBody, getWebhookSecret());
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new WebhookSignatureError();
  }

  return true;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeMetadata(value: unknown): Record<string, JsonValue> {
  const metadata = asRecord(value);

  return Object.fromEntries(
    Object.entries(metadata).filter(([, entry]) =>
      entry === null ||
      ["string", "number", "boolean"].includes(typeof entry) ||
      Array.isArray(entry) ||
      (typeof entry === "object" && entry !== null),
    ),
  ) as Record<string, JsonValue>;
}

export function parseCreemWebhookEvent(rawBody: string): ParsedCreemWebhookEvent {
  const raw = JSON.parse(rawBody) as JsonValue;
  const root = asRecord(raw);
  const type = stringValue(root.type) ?? stringValue(root.eventType) ?? "unknown";
  const id = stringValue(root.id) ?? "unknown";

  if (type !== "checkout.completed" && type !== "refund.created") {
    return { id, type, ignored: true, raw };
  }

  const object = asRecord(root.object);

  if (type === "refund.created") {
    const transaction = asRecord(object.transaction);
    const checkout = asRecord(object.checkout);
    const order = asRecord(object.order);
    const refundId = stringValue(object.id);
    const externalOrderId = stringValue(checkout.request_id);
    const productId = stringValue(order.product);
    const amountCents = numberValue(order.amount);
    const currency = stringValue(order.currency);
    const objectStatus = stringValue(object.status);
    const transactionStatus = stringValue(transaction.status);
    const refundAmount = numberValue(object.refund_amount);
    const refundCurrency = stringValue(object.refund_currency);
    const amountPaid = numberValue(transaction.amount_paid);
    const refundedAmount = numberValue(transaction.refunded_amount);
    const transactionCurrency = stringValue(transaction.currency);

    if (
      !refundId ||
      !externalOrderId ||
      !productId ||
      amountCents === null ||
      !currency ||
      !objectStatus ||
      !transactionStatus ||
      refundAmount === null ||
      !refundCurrency ||
      amountPaid === null ||
      refundedAmount === null ||
      !transactionCurrency
    ) {
      throw new Error("Creem refund.created event is missing required fields.");
    }

    if (
      objectStatus !== "succeeded" ||
      transactionStatus !== "refunded" ||
      refundAmount !== amountPaid ||
      refundAmount !== refundedAmount ||
      refundCurrency !== transactionCurrency ||
      refundCurrency !== currency
    ) {
      throw new Error(
        "Creem refund.created event is not a successful full refund.",
      );
    }

    return {
      id,
      type,
      refundId,
      externalOrderId,
      productId,
      amountCents,
      currency,
      transactionStatus: "refunded",
      metadata: normalizeMetadata(checkout.metadata),
      raw,
    };
  }

  const order = asRecord(object.order);
  const product = asRecord(object.product);
  const customer = asRecord(object.customer);
  const externalOrderId = stringValue(object.request_id);
  const checkoutId = stringValue(object.id);
  const productId = stringValue(product.id) ?? stringValue(object.product_id);
  const amountCents =
    numberValue(order.amount) ?? numberValue(object.amount) ?? null;
  const currency = stringValue(order.currency) ?? stringValue(object.currency);

  if (
    !externalOrderId ||
    !checkoutId ||
    !productId ||
    amountCents === null ||
    !currency
  ) {
    throw new Error("Creem checkout.completed event is missing required fields.");
  }

  return {
    id,
    type,
    externalOrderId,
    checkoutId,
    productId,
    amountCents,
    currency,
    customerEmail: stringValue(customer.email),
    metadata: normalizeMetadata(object.metadata),
    raw,
  };
}
