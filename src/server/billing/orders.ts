import { randomUUID } from "node:crypto";

import type { CreditLedgerResult } from "@/lib/credits/ledger";
import { purchaseCredits, reversePurchasedCredits } from "@/lib/credits/ledger";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { getCreditPackage } from "@/lib/credits/packages";
import type { JsonValue } from "@/lib/db/schema/common";
import type {
  CreemCheckoutCompletedEvent,
  CreemRefundCreatedEvent,
} from "@/lib/providers/creem/webhook";

export type OrderStatus = "created" | "paid" | "failed" | "refunded" | "cancelled";

export class OrderStateConflictError extends Error {
  constructor(externalOrderId: string, from: OrderStatus, to: OrderStatus) {
    super(`Order ${externalOrderId} cannot transition from ${from} to ${to}.`);
    this.name = "OrderStateConflictError";
  }
}

export interface BillingOrder {
  id: string;
  userId: string;
  status: OrderStatus;
  provider: "creem";
  externalOrderId: string;
  productCode: string;
  amountCents: number;
  currency: string;
  creditsGranted: number;
  webhookEventId: string | null;
  checkoutSnapshot: JsonValue | null;
  webhookSnapshot: JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NewBillingOrder {
  userId: string;
  externalOrderId: string;
  productCode: string;
  amountCents: number;
  currency: string;
  creditsGranted: number;
  checkoutSnapshot?: JsonValue | null;
}

interface OrderPaidChanges {
  status: "paid";
  webhookEventId: string;
  webhookSnapshot: JsonValue;
}

export interface OrderStore {
  createOrder(input: NewBillingOrder): Promise<BillingOrder>;
  findOrderByExternalOrderId(externalOrderId: string): Promise<BillingOrder | null>;
  updateCheckoutSnapshot(
    externalOrderId: string,
    checkoutSnapshot: JsonValue,
  ): Promise<BillingOrder>;
  markOrderStatus(
    externalOrderId: string,
    status: Extract<OrderStatus, "failed" | "cancelled" | "refunded">,
    webhook?: { eventId: string; snapshot: JsonValue },
  ): Promise<BillingOrder>;
  markOrderPaid(
    externalOrderId: string,
    changes: OrderPaidChanges,
  ): Promise<BillingOrder>;
}

export function createInMemoryOrderStore(): OrderStore & {
  listOrders: () => BillingOrder[];
} {
  const orders = new Map<string, BillingOrder>();

  return {
    async createOrder(input) {
      const now = new Date();
      const order: BillingOrder = {
        id: randomUUID(),
        status: "created",
        provider: "creem",
        webhookEventId: null,
        webhookSnapshot: null,
        checkoutSnapshot: input.checkoutSnapshot ?? null,
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      orders.set(order.externalOrderId, order);
      return order;
    },
    async findOrderByExternalOrderId(externalOrderId) {
      return orders.get(externalOrderId) ?? null;
    },
    async updateCheckoutSnapshot(externalOrderId, checkoutSnapshot) {
      const order = orders.get(externalOrderId);
      if (!order) {
        throw new Error(`Order not found: ${externalOrderId}.`);
      }

      const updated = {
        ...order,
        checkoutSnapshot,
        updatedAt: new Date(),
      };
      orders.set(externalOrderId, updated);
      return updated;
    },
    async markOrderStatus(externalOrderId, status, webhook) {
      const order = orders.get(externalOrderId);
      if (!order) {
        throw new Error(`Order not found: ${externalOrderId}.`);
      }

      const allowedStatuses: OrderStatus[] =
        status === "refunded"
          ? ["paid", "refunded"]
          : status === "failed"
            ? ["created", "failed"]
            : ["created", "cancelled"];
      if (!allowedStatuses.includes(order.status)) {
        throw new OrderStateConflictError(externalOrderId, order.status, status);
      }

      const updated = {
        ...order,
        status,
        ...(webhook
          ? {
              webhookEventId: webhook.eventId,
              webhookSnapshot: webhook.snapshot,
            }
          : {}),
        updatedAt: new Date(),
      };
      orders.set(externalOrderId, updated);
      return updated;
    },
    async markOrderPaid(externalOrderId, changes) {
      const order = orders.get(externalOrderId);
      if (!order) {
        throw new Error(`Order not found: ${externalOrderId}.`);
      }
      if (!["created", "failed", "paid"].includes(order.status)) {
        throw new OrderStateConflictError(
          externalOrderId,
          order.status,
          "paid",
        );
      }

      const updated: BillingOrder = {
        ...order,
        ...changes,
        updatedAt: new Date(),
      };
      orders.set(externalOrderId, updated);
      return updated;
    },
    listOrders() {
      return Array.from(orders.values());
    },
  };
}

export async function createCheckoutOrder({
  store,
  userId,
  packageCode,
  externalOrderId,
  checkoutSnapshot,
}: {
  store: OrderStore;
  userId: string;
  packageCode: string;
  externalOrderId: string;
  checkoutSnapshot?: JsonValue | null;
}) {
  const selectedPackage = getCreditPackage(packageCode);
  if (!selectedPackage) {
    throw new Error(`Unknown credit package: ${packageCode}.`);
  }

  return store.createOrder({
    userId,
    externalOrderId,
    productCode: selectedPackage.code,
    amountCents: selectedPackage.amountCents,
    currency: selectedPackage.currency,
    creditsGranted: selectedPackage.credits,
    checkoutSnapshot: checkoutSnapshot ?? null,
  });
}

function metadataString(
  metadata: Record<string, JsonValue>,
  key: string,
) {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function checkoutSnapshotProductId(snapshot: JsonValue | null) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const productId = (snapshot as Record<string, unknown>).creemProductId;
  return typeof productId === "string" && productId.trim()
    ? productId.trim()
    : null;
}

function assertPaidEventMatchesOrder(
  event: CreemCheckoutCompletedEvent,
  order: BillingOrder,
) {
  const eventUserId = metadataString(event.metadata, "userId");

  if (eventUserId !== order.userId) {
    throw new Error("Creem paid event user does not match the local order.");
  }

  const selectedPackage = getCreditPackage(order.productCode);
  if (!selectedPackage) {
    throw new Error(`Unknown credit package: ${order.productCode}.`);
  }

  const checkoutProductId = checkoutSnapshotProductId(order.checkoutSnapshot);
  if (!checkoutProductId) {
    throw new Error("Creem checkout product snapshot is missing.");
  }

  if (
    metadataString(event.metadata, "packageCode") !== order.productCode ||
    event.productId !== checkoutProductId ||
    event.amountCents !== order.amountCents ||
    event.currency !== order.currency ||
    order.amountCents !== selectedPackage.amountCents ||
    order.currency !== selectedPackage.currency ||
    order.creditsGranted !== selectedPackage.credits
  ) {
    throw new Error("Creem paid event does not match the local order.");
  }
}

export async function handleCreemCheckoutCompleted({
  orderStore,
  ledgerStore,
  event,
}: {
  orderStore: OrderStore;
  ledgerStore: CreditLedgerStore;
  event: CreemCheckoutCompletedEvent;
}): Promise<{ order: BillingOrder; ledgerResult: CreditLedgerResult }> {
  const order = await orderStore.findOrderByExternalOrderId(
    event.externalOrderId,
  );
  if (!order) {
    throw new Error(`Order not found: ${event.externalOrderId}.`);
  }

  assertPaidEventMatchesOrder(event, order);

  if (order.status === "cancelled") {
    throw new OrderStateConflictError(
      order.externalOrderId,
      order.status,
      "paid",
    );
  }

  const ledgerResult = await purchaseCredits({
    store: ledgerStore,
    userId: order.userId,
    amount: order.creditsGranted,
    relatedOrderId: order.id,
    reason: `Creem purchase ${order.productCode}`,
    idempotencyKey: `purchase:creem:${order.externalOrderId}`,
    metadata: {
      creemEventId: event.id,
      externalOrderId: event.externalOrderId,
      checkoutId: event.checkoutId,
      productId: event.productId,
      customerEmail: event.customerEmail,
    },
  });
  if (order.status === "refunded") {
    return { order, ledgerResult };
  }

  let paidOrder: BillingOrder;
  try {
    paidOrder = await orderStore.markOrderPaid(order.externalOrderId, {
      status: "paid",
      webhookEventId: event.id,
      webhookSnapshot: event.raw,
    });
  } catch (error) {
    if (error instanceof OrderStateConflictError) {
      const currentOrder = await orderStore.findOrderByExternalOrderId(
        order.externalOrderId,
      );
      if (currentOrder?.status === "refunded") {
        return { order: currentOrder, ledgerResult };
      }
    }
    throw error;
  }

  return {
    order: paidOrder,
    ledgerResult,
  };
}

function refundIdFromSnapshot(snapshot: JsonValue | null) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const object = (snapshot as Record<string, unknown>).object;
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return null;
  }

  const refundId = (object as Record<string, unknown>).id;
  return typeof refundId === "string" ? refundId : null;
}

function assertRefundEventMatchesOrder(
  event: CreemRefundCreatedEvent,
  order: BillingOrder,
) {
  if (metadataString(event.metadata, "userId") !== order.userId) {
    throw new Error("Creem refund event user does not match the local order.");
  }

  const checkoutProductId = checkoutSnapshotProductId(order.checkoutSnapshot);
  if (!checkoutProductId) {
    throw new Error("Creem checkout product snapshot is missing.");
  }

  if (
    metadataString(event.metadata, "packageCode") !== order.productCode ||
    event.productId !== checkoutProductId ||
    event.amountCents !== order.amountCents ||
    event.currency !== order.currency ||
    event.transactionStatus !== "refunded"
  ) {
    throw new Error("Creem refund event does not match the local order.");
  }
}

export async function handleCreemRefundCreated({
  orderStore,
  ledgerStore,
  event,
}: {
  orderStore: OrderStore;
  ledgerStore: CreditLedgerStore;
  event: CreemRefundCreatedEvent;
}): Promise<{ order: BillingOrder; ledgerResult: CreditLedgerResult }> {
  const order = await orderStore.findOrderByExternalOrderId(
    event.externalOrderId,
  );
  if (!order) {
    throw new Error(`Order not found: ${event.externalOrderId}.`);
  }

  if (order.status === "refunded") {
    if (refundIdFromSnapshot(order.webhookSnapshot) !== event.refundId) {
      throw new Error("Creem order has already been refunded.");
    }
  } else if (order.status !== "paid") {
    throw new Error("Creem refund requires a paid local order.");
  }

  assertRefundEventMatchesOrder(event, order);

  const ledgerResult = await reversePurchasedCredits({
    store: ledgerStore,
    userId: order.userId,
    amount: order.creditsGranted,
    relatedOrderId: order.id,
    reason: `Creem refund ${order.productCode}`,
    idempotencyKey: `purchase-refund:creem:order:${order.externalOrderId}`,
    metadata: {
      refundId: event.refundId,
      externalOrderId: event.externalOrderId,
      productId: event.productId,
    },
  });
  const refundedOrder = await orderStore.markOrderStatus(
    order.externalOrderId,
    "refunded",
    { eventId: event.id, snapshot: event.raw },
  );

  return { order: refundedOrder, ledgerResult };
}
