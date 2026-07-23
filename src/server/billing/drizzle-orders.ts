import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";

import {
  OrderStateConflictError,
  type BillingOrder,
  type OrderStatus,
  type OrderStore,
} from "./orders";

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleOrderStore(db: DbClient = getDb()): OrderStore {
  async function throwOrderUpdateError(
    externalOrderId: string,
    targetStatus: OrderStatus,
  ): Promise<never> {
    const [existing] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.externalOrderId, externalOrderId))
      .limit(1);

    if (!existing) {
      throw new Error(`Order not found: ${externalOrderId}.`);
    }

    throw new OrderStateConflictError(
      externalOrderId,
      existing.status,
      targetStatus,
    );
  }

  return {
    async createOrder(input) {
      const [order] = await db
        .insert(orders)
        .values(input)
        .returning();

      if (!order) {
        throw new Error("Failed to create billing order.");
      }

      return order as BillingOrder;
    },
    async findOrderByExternalOrderId(externalOrderId) {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.externalOrderId, externalOrderId))
        .limit(1);

      return (order as BillingOrder | undefined) ?? null;
    },
    async updateCheckoutSnapshot(externalOrderId, checkoutSnapshot) {
      const [order] = await db
        .update(orders)
        .set({ checkoutSnapshot, updatedAt: new Date() })
        .where(eq(orders.externalOrderId, externalOrderId))
        .returning();

      if (!order) {
        throw new Error(`Order not found: ${externalOrderId}.`);
      }

      return order as BillingOrder;
    },
    async markOrderStatus(externalOrderId, status, webhook) {
      const allowedStatuses =
        status === "refunded"
          ? (["paid", "refunded"] as const)
          : status === "failed"
            ? (["created", "failed"] as const)
            : (["created", "cancelled"] as const);
      const [order] = await db
        .update(orders)
        .set({
          status,
          ...(webhook
            ? {
                webhookEventId: webhook.eventId,
                webhookSnapshot: webhook.snapshot,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.externalOrderId, externalOrderId),
            inArray(orders.status, allowedStatuses),
          ),
        )
        .returning();

      if (!order) {
        return throwOrderUpdateError(externalOrderId, status);
      }

      return order as BillingOrder;
    },
    async markOrderPaid(externalOrderId, changes) {
      const [order] = await db
        .update(orders)
        .set({ ...changes, updatedAt: new Date() })
        .where(
          and(
            eq(orders.externalOrderId, externalOrderId),
            inArray(orders.status, ["created", "failed", "paid"]),
          ),
        )
        .returning();

      if (!order) {
        return throwOrderUpdateError(externalOrderId, "paid");
      }

      return order as BillingOrder;
    },
  };
}
