import type { JsonValue } from "@/lib/db/schema/common";

import type {
  CreditLedgerEntry,
  CreditLedgerStore,
  CreditLedgerTransaction,
  CreditLedgerType,
  CreditWallet,
} from "./types";

export interface CreditLedgerResult {
  wallet: CreditWallet;
  ledger: CreditLedgerEntry;
  idempotent: boolean;
}

interface CreditOperationInput {
  store: CreditLedgerStore;
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  relatedJobId?: string | null;
  relatedOrderId?: string | null;
  metadata?: JsonValue | null;
}

function assertPositiveAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer.");
  }
}

function assertReason(reason: string) {
  if (!reason.trim()) {
    throw new Error("A reason is required for credit ledger entries.");
  }
}

async function applyCreditOperation({
  input,
  type,
  mutate,
}: {
  input: CreditOperationInput;
  type: CreditLedgerType;
  mutate: (wallet: CreditWallet) => {
    walletChanges: Partial<CreditWallet>;
    amountForLedger?: number;
  };
}): Promise<CreditLedgerResult> {
  assertPositiveAmount(input.amount);
  assertReason(input.reason);

  return input.store.transaction(async (tx) => {
    const wallet = await tx.getOrCreateWalletForUpdate(input.userId);
    const existing = await tx.findLedgerByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return { wallet, ledger: existing, idempotent: true };
    }

    const balanceBefore = wallet.availableBalance;
    const reservedBefore = wallet.reservedBalance;
    const { walletChanges, amountForLedger = input.amount } = mutate(wallet);
    const updatedWallet = await tx.updateWallet(input.userId, walletChanges);
    const ledger = await tx.createLedgerEntry({
      userId: input.userId,
      walletId: wallet.id,
      type,
      amount: amountForLedger,
      balanceBefore,
      balanceAfter: updatedWallet.availableBalance,
      reservedBefore,
      reservedAfter: updatedWallet.reservedBalance,
      relatedJobId: input.relatedJobId ?? null,
      relatedOrderId: input.relatedOrderId ?? null,
      reason: input.reason.trim(),
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? null,
    });

    return { wallet: updatedWallet, ledger, idempotent: false };
  });
}

export function purchaseCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "purchase",
    mutate: (wallet) => ({
      walletChanges: {
        availableBalance: wallet.availableBalance + input.amount,
        totalPurchased: wallet.totalPurchased + input.amount,
      },
    }),
  });
}

export function reversePurchasedCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "purchase_reversal",
    mutate: (wallet) => ({
      walletChanges: {
        availableBalance: wallet.availableBalance - input.amount,
      },
      amountForLedger: -input.amount,
    }),
  });
}

export function grantTrialCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "trial_grant",
    mutate: (wallet) => ({
      walletChanges: {
        availableBalance: wallet.availableBalance + input.amount,
        totalGranted: wallet.totalGranted + input.amount,
      },
    }),
  });
}

export function reserveCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "reserve",
    mutate: (wallet) => {
      if (wallet.availableBalance < input.amount) {
        throw new Error("Insufficient available credits.");
      }

      return {
        walletChanges: {
          availableBalance: wallet.availableBalance - input.amount,
          reservedBalance: wallet.reservedBalance + input.amount,
        },
      };
    },
  });
}

export function captureReservedCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "capture",
    mutate: (wallet) => {
      if (wallet.reservedBalance < input.amount) {
        throw new Error("Insufficient reserved credits.");
      }

      return {
        walletChanges: {
          reservedBalance: wallet.reservedBalance - input.amount,
          totalCaptured: wallet.totalCaptured + input.amount,
        },
      };
    },
  });
}

export function releaseReservedCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "release",
    mutate: (wallet) => {
      if (wallet.reservedBalance < input.amount) {
        throw new Error("Insufficient reserved credits.");
      }

      return {
        walletChanges: {
          availableBalance: wallet.availableBalance + input.amount,
          reservedBalance: wallet.reservedBalance - input.amount,
        },
      };
    },
  });
}

export function refundCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "refund",
    mutate: (wallet) => ({
      walletChanges: {
        availableBalance: wallet.availableBalance + input.amount,
      },
    }),
  });
}

export function adjustCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "admin_adjust",
    mutate: (wallet) => ({
      walletChanges: {
        availableBalance: wallet.availableBalance + input.amount,
      },
    }),
  });
}
