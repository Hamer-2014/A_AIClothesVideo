import { integer, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { id, jsonSnapshot, timestamps } from "./common";

export const creditLedgerTypeValues = [
  "purchase",
  "trial_grant",
  "reserve",
  "capture",
  "release",
  "refund",
  "purchase_reversal",
  "admin_adjust",
] as const;
export const creditLedgerTypeEnum = pgEnum(
  "credit_ledger_type",
  creditLedgerTypeValues,
);

export const orderStatusValues = [
  "created",
  "paid",
  "failed",
  "refunded",
  "cancelled",
] as const;
export const orderStatusEnum = pgEnum("order_status", orderStatusValues);

export const creditWallets = pgTable("credit_wallets", {
  ...id,
  userId: text("user_id").notNull().unique(),
  availableBalance: integer("available_balance").notNull().default(0),
  reservedBalance: integer("reserved_balance").notNull().default(0),
  totalPurchased: integer("total_purchased").notNull().default(0),
  totalGranted: integer("total_granted").notNull().default(0),
  totalCaptured: integer("total_captured").notNull().default(0),
  ...timestamps,
});

export const creditLedger = pgTable("credit_ledger", {
  ...id,
  userId: text("user_id").notNull(),
  walletId: uuid("wallet_id"),
  type: creditLedgerTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reservedBefore: integer("reserved_before").notNull().default(0),
  reservedAfter: integer("reserved_after").notNull().default(0),
  relatedJobId: uuid("related_job_id"),
  relatedOrderId: uuid("related_order_id"),
  reason: text("reason").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  metadata: jsonSnapshot("metadata"),
  ...timestamps,
});

export const orders = pgTable("orders", {
  ...id,
  userId: text("user_id").notNull(),
  status: orderStatusEnum("status").notNull().default("created"),
  provider: text("provider").notNull().default("creem"),
  externalOrderId: text("external_order_id").notNull().unique(),
  productCode: text("product_code").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  creditsGranted: integer("credits_granted").notNull(),
  webhookEventId: text("webhook_event_id"),
  checkoutSnapshot: jsonSnapshot("checkout_snapshot"),
  webhookSnapshot: jsonSnapshot("webhook_snapshot"),
  ...timestamps,
});
