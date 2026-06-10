import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creditLedger, creditWallets, orders } from "@/lib/db/schema";
import type { CreditLedgerType } from "@/lib/credits/types";

export interface UserBillingWallet {
  id: string;
  userId: string;
  availableBalance: number;
  reservedBalance: number;
  totalPurchased: number;
  totalGranted: number;
  totalCaptured: number;
}

export interface UserBillingOrder {
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

export interface UserBillingLedgerEntry {
  id: string;
  userId: string;
  type: CreditLedgerType;
  amount: number;
  relatedJobId: string | null;
  relatedOrderId: string | null;
  reason: string;
  createdAt: Date;
}

export interface UserBillingStore {
  findWallet(userId: string): Promise<UserBillingWallet | null>;
  listOrders(userId: string): Promise<UserBillingOrder[]>;
  listLedger(userId: string): Promise<UserBillingLedgerEntry[]>;
}

export function createInMemoryUserBillingStore(input: {
  wallets: UserBillingWallet[];
  orders: UserBillingOrder[];
  ledger: UserBillingLedgerEntry[];
}): UserBillingStore {
  return {
    async findWallet(userId) {
      return input.wallets.find((wallet) => wallet.userId === userId) ?? null;
    },
    async listOrders(userId) {
      return input.orders
        .filter((order) => order.userId === userId)
        .map((order) => ({ ...order }));
    },
    async listLedger(userId) {
      return input.ledger
        .filter((entry) => entry.userId === userId)
        .map((entry) => ({ ...entry }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleUserBillingStore(
  db: DbClient = getDb(),
): UserBillingStore {
  return {
    async findWallet(userId) {
      const [wallet] = await db
        .select({
          id: creditWallets.id,
          userId: creditWallets.userId,
          availableBalance: creditWallets.availableBalance,
          reservedBalance: creditWallets.reservedBalance,
          totalPurchased: creditWallets.totalPurchased,
          totalGranted: creditWallets.totalGranted,
          totalCaptured: creditWallets.totalCaptured,
        })
        .from(creditWallets)
        .where(eq(creditWallets.userId, userId))
        .limit(1);

      return (wallet as UserBillingWallet | undefined) ?? null;
    },
    async listOrders(userId) {
      return db
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
        .from(orders)
        .where(eq(orders.userId, userId));
    },
    async listLedger(userId) {
      return db
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
        .from(creditLedger)
        .where(eq(creditLedger.userId, userId));
    },
  };
}

export async function getUserBillingOverview({
  store,
  userId,
}: {
  store: UserBillingStore;
  userId: string;
}) {
  const [wallet, userOrders, userLedger] = await Promise.all([
    store.findWallet(userId),
    store.listOrders(userId),
    store.listLedger(userId),
  ]);

  return {
    wallet,
    orders: userOrders,
    ledger: userLedger,
  };
}
