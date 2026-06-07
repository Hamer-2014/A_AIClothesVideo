import { randomUUID } from "node:crypto";

import type { CreditLedgerResult } from "@/lib/credits/ledger";
import { purchaseCredits } from "@/lib/credits/ledger";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { getCreditPackage } from "@/lib/credits/packages";
import type { JsonValue } from "@/lib/db/schema/common";
import type { CreemCheckoutCompletedEvent } from "@/lib/providers/creem/webhook";

export type OrderStatus = "created" | "paid" | "failed" | "refunded" | "cancelled";

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
    async markOrderPaid(externalOrderId, changes) {
      const order = orders.get(externalOrderId);
      if (!order) {
        throw new Error(`Order not found: ${externalOrderId}.`);
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

function assertPaidEventMatchesOrder(
  event: CreemCheckoutCompletedEvent,
  order: BillingOrder,
) {
  const eventUserId = metadataString(event.metadata, "userId");

  if (eventUserId !== order.userId) {
    throw new Error("Creem paid event user does not match the local order.");
  }

  if (
    event.productId !== order.productCode ||
    event.amountCents !== order.amountCents ||
    event.currency !== order.currency
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
  const paidOrder = await orderStore.markOrderPaid(order.externalOrderId, {
    status: "paid",
    webhookEventId: event.id,
    webhookSnapshot: event.raw,
  });

  return {
    order: paidOrder,
    ledgerResult,
  };
}
