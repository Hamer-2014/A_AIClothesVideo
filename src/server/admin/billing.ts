import { eq } from "drizzle-orm";

import { creditPackages } from "@/lib/credits/packages";
import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import { adjustCredits } from "@/lib/credits/ledger";
import type { CreditLedgerStore, CreditLedgerType } from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import { creditLedger, creditWallets, orders } from "@/lib/db/schema";
import { canRolePerformAdminAction, type AdminRole } from "@/server/auth/admin-access";

import {
  type AdminAuditActor,
  type AdminAuditStore,
  type AdminAuditRequestMeta,
  normalizeAdminReason,
  toAuditSnapshot,
  writeAdminAuditLog,
} from "./audit";

export interface BillingOpsActor extends AdminAuditActor {
  role: AdminRole;
}

export interface BillingWalletRecord {
  id: string;
  userId: string;
  availableBalance: number;
  reservedBalance: number;
  totalPurchased: number;
  totalGranted: number;
  totalCaptured: number;
}

export interface BillingOrderRecord {
  id: string;
  userId: string;
  status: string;
  provider: string;
  productCode: string;
  amountCents: number;
  currency: string;
  creditsGranted: number;
  createdAt: Date;
}

export interface BillingLedgerRecord {
  id: string;
  userId: string;
  type: CreditLedgerType;
  amount: number;
  relatedJobId: string | null;
  relatedOrderId: string | null;
  reason: string;
  createdAt: Date;
}

export interface BillingOpsStore {
  listWallets(userId?: string): Promise<BillingWalletRecord[]>;
  listOrders(userId?: string): Promise<BillingOrderRecord[]>;
  listLedger(userId?: string): Promise<BillingLedgerRecord[]>;
}

export async function getBillingOpsOverview({
  store,
  userId,
}: {
  store: BillingOpsStore;
  userId?: string;
}) {
  const [wallets, orderRecords, ledgerRecords] = await Promise.all([
    store.listWallets(userId),
    store.listOrders(userId),
    store.listLedger(userId),
  ]);

  return {
    wallets,
    orders: orderRecords,
    ledger: ledgerRecords,
    creditPackages,
    pricingSource: "code" as const,
    creemVerificationStatus: "pending_creem_approval" as const,
  };
}

export async function adjustUserCreditsByAdmin({
  ledgerStore = createDrizzleCreditLedgerStore(),
  auditStore,
  actor,
  targetUserId,
  amount,
  reason,
  idempotencyKey,
  relatedJobId,
  requestMeta,
}: {
  ledgerStore?: CreditLedgerStore;
  auditStore: AdminAuditStore;
  actor: BillingOpsActor;
  targetUserId: string;
  amount: number;
  reason: string;
  idempotencyKey?: string;
  relatedJobId?: string;
  requestMeta?: AdminAuditRequestMeta;
}) {
  if (!canRolePerformAdminAction(actor.role, "credits:admin_adjust")) {
    throw new Error("Actor cannot adjust credits.");
  }

  const normalizedReason = normalizeAdminReason(reason);

  const result = await adjustCredits({
    store: ledgerStore,
    userId: targetUserId,
    amount,
    reason: normalizedReason,
    idempotencyKey:
      idempotencyKey ?? `admin_adjust:${targetUserId}:${actor.userId}:${Date.now()}`,
    relatedJobId: relatedJobId ?? null,
    metadata: {
      actorUserId: actor.userId,
      actorEmail: actor.email,
      relatedJobId: relatedJobId ?? null,
    },
  });

  if (!result.idempotent) {
    await writeAdminAuditLog({
      store: auditStore,
      actor,
      action: "credits:admin_adjust",
      targetType: relatedJobId ? "video_job" : "user",
      targetId: relatedJobId ?? targetUserId,
      reason: normalizedReason,
      beforeSnapshot: null,
      afterSnapshot: toAuditSnapshot(result.ledger),
      requestMeta,
    });
  }

  return result;
}

export function createInMemoryBillingOpsStore(input: {
  wallets: BillingWalletRecord[];
  orders: BillingOrderRecord[];
  ledger: BillingLedgerRecord[];
}): BillingOpsStore {
  return {
    async listWallets(userId) {
      return input.wallets.filter((wallet) => !userId || wallet.userId === userId);
    },
    async listOrders(userId) {
      return input.orders.filter((order) => !userId || order.userId === userId);
    },
    async listLedger(userId) {
      return input.ledger.filter((entry) => !userId || entry.userId === userId);
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleBillingOpsStore(
  db: DbClient = getDb(),
): BillingOpsStore {
  return {
    async listWallets(userId) {
      const query = db
        .select({
          id: creditWallets.id,
          userId: creditWallets.userId,
          availableBalance: creditWallets.availableBalance,
          reservedBalance: creditWallets.reservedBalance,
          totalPurchased: creditWallets.totalPurchased,
          totalGranted: creditWallets.totalGranted,
          totalCaptured: creditWallets.totalCaptured,
        })
        .from(creditWallets);

      return userId ? query.where(eq(creditWallets.userId, userId)) : query;
    },
    async listOrders(userId) {
      const query = db
        .select({
          id: orders.id,
          userId: orders.userId,
          status: orders.status,
          provider: orders.provider,
          productCode: orders.productCode,
          amountCents: orders.amountCents,
          currency: orders.currency,
          creditsGranted: orders.creditsGranted,
          createdAt: orders.createdAt,
        })
        .from(orders);

      return userId ? query.where(eq(orders.userId, userId)) : query;
    },
    async listLedger(userId) {
      const query = db
        .select({
          id: creditLedger.id,
          userId: creditLedger.userId,
          type: creditLedger.type,
          amount: creditLedger.amount,
          relatedJobId: creditLedger.relatedJobId,
          relatedOrderId: creditLedger.relatedOrderId,
          reason: creditLedger.reason,
          createdAt: creditLedger.createdAt,
        })
        .from(creditLedger);

      return userId ? query.where(eq(creditLedger.userId, userId)) : query;
    },
  };
}
