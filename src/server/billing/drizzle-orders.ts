import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";

import type { BillingOrder, OrderStore } from "./orders";

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleOrderStore(db: DbClient = getDb()): OrderStore {
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
    async markOrderPaid(externalOrderId, changes) {
      const [order] = await db
        .update(orders)
        .set(changes)
        .where(eq(orders.externalOrderId, externalOrderId))
        .returning();

      if (!order) {
        throw new Error(`Order not found: ${externalOrderId}.`);
      }

      return order as BillingOrder;
    },
  };
}
