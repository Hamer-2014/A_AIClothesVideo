import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creditLedger, creditWallets } from "@/lib/db/schema";

import type {
  CreditLedgerEntry,
  CreditLedgerStore,
  CreditLedgerTransaction,
  CreditWallet,
  NewCreditLedgerEntry,
  NewCreditWallet,
  WalletChanges,
} from "./types";

type DbClient = ReturnType<typeof getDb>;
type TransactionClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

function createTransactionAdapter(tx: TransactionClient): CreditLedgerTransaction {
  return {
    async findLedgerByIdempotencyKey(idempotencyKey) {
      const [entry] = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.idempotencyKey, idempotencyKey))
        .limit(1);

      return (entry as CreditLedgerEntry | undefined) ?? null;
    },
    async findWalletByUserId(userId) {
      const [wallet] = await tx
        .select()
        .from(creditWallets)
        .where(eq(creditWallets.userId, userId))
        .limit(1);

      return (wallet as CreditWallet | undefined) ?? null;
    },
    async createWallet(input: NewCreditWallet) {
      const [wallet] = await tx
        .insert(creditWallets)
        .values(input)
        .returning();

      if (!wallet) {
        throw new Error("Failed to create credit wallet.");
      }

      return wallet as CreditWallet;
    },
    async updateWallet(userId: string, changes: WalletChanges) {
      const [wallet] = await tx
        .update(creditWallets)
        .set(changes)
        .where(eq(creditWallets.userId, userId))
        .returning();

      if (!wallet) {
        throw new Error(`Wallet not found for user ${userId}.`);
      }

      return wallet as CreditWallet;
    },
    async createLedgerEntry(input: NewCreditLedgerEntry) {
      const [entry] = await tx
        .insert(creditLedger)
        .values(input)
        .returning();

      if (!entry) {
        throw new Error("Failed to create credit ledger entry.");
      }

      return entry as CreditLedgerEntry;
    },
  };
}

export function createDrizzleCreditLedgerStore(
  db: DbClient = getDb(),
): CreditLedgerStore {
  return {
    async transaction(callback) {
      return db.transaction((tx) => callback(createTransactionAdapter(tx)));
    },
  };
}
