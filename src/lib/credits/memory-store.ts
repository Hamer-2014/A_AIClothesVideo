import { randomUUID } from "node:crypto";

import type {
  CreditLedgerEntry,
  CreditLedgerStore,
  CreditLedgerTransaction,
  CreditWallet,
  NewCreditLedgerEntry,
} from "./types";

export function createInMemoryCreditLedgerStore(): CreditLedgerStore & {
  listLedger: () => CreditLedgerEntry[];
} {
  const wallets = new Map<string, CreditWallet>();
  const ledger = new Map<string, CreditLedgerEntry>();
  let transactionTail = Promise.resolve();

  const tx: CreditLedgerTransaction = {
    async findLedgerByIdempotencyKey(idempotencyKey) {
      return ledger.get(idempotencyKey) ?? null;
    },
    async getOrCreateWalletForUpdate(userId) {
      const existing = wallets.get(userId);
      if (existing) return existing;

      const now = new Date();
      const wallet: CreditWallet = {
        id: randomUUID(),
        userId,
        availableBalance: 0,
        reservedBalance: 0,
        totalPurchased: 0,
        totalGranted: 0,
        totalCaptured: 0,
        createdAt: now,
        updatedAt: now,
      };
      wallets.set(wallet.userId, wallet);
      return wallet;
    },
    async updateWallet(userId, changes) {
      const wallet = wallets.get(userId);
      if (!wallet) {
        throw new Error(`Wallet not found for user ${userId}.`);
      }

      const updated = { ...wallet, ...changes, updatedAt: new Date() };
      wallets.set(userId, updated);
      return updated;
    },
    async createLedgerEntry(input: NewCreditLedgerEntry) {
      const now = new Date();
      const entry: CreditLedgerEntry = {
        id: randomUUID(),
        walletId: input.walletId ?? null,
        relatedJobId: input.relatedJobId ?? null,
        relatedOrderId: input.relatedOrderId ?? null,
        metadata: input.metadata ?? null,
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      ledger.set(entry.idempotencyKey, entry);
      return entry;
    },
  };

  return {
    async transaction(callback) {
      let releaseTransaction: () => void = () => undefined;
      const previousTransaction = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        releaseTransaction = resolve;
      });

      await previousTransaction;
      try {
        return await callback(tx);
      } finally {
        releaseTransaction();
      }
    },
    listLedger() {
      return Array.from(ledger.values());
    },
  };
}
