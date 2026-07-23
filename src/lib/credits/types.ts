import type { JsonValue } from "@/lib/db/schema/common";
import type { creditLedgerTypeValues } from "@/lib/db/schema/credits";

export type CreditLedgerType = (typeof creditLedgerTypeValues)[number];

export interface CreditWallet {
  id: string;
  userId: string;
  availableBalance: number;
  reservedBalance: number;
  totalPurchased: number;
  totalGranted: number;
  totalCaptured: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  walletId: string | null;
  type: CreditLedgerType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  relatedJobId: string | null;
  relatedOrderId: string | null;
  reason: string;
  idempotencyKey: string;
  metadata: JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewCreditWallet {
  userId: string;
  availableBalance?: number;
  reservedBalance?: number;
  totalPurchased?: number;
  totalGranted?: number;
  totalCaptured?: number;
}

export type WalletChanges = Partial<
  Pick<
    CreditWallet,
    | "availableBalance"
    | "reservedBalance"
    | "totalPurchased"
    | "totalGranted"
    | "totalCaptured"
  >
>;

export interface NewCreditLedgerEntry {
  userId: string;
  walletId?: string | null;
  type: CreditLedgerType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  relatedJobId?: string | null;
  relatedOrderId?: string | null;
  reason: string;
  idempotencyKey: string;
  metadata?: JsonValue | null;
}

export interface CreditLedgerTransaction {
  findLedgerByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CreditLedgerEntry | null>;
  getOrCreateWalletForUpdate(userId: string): Promise<CreditWallet>;
  updateWallet(userId: string, changes: WalletChanges): Promise<CreditWallet>;
  createLedgerEntry(input: NewCreditLedgerEntry): Promise<CreditLedgerEntry>;
}

export interface CreditLedgerStore {
  transaction<T>(
    callback: (tx: CreditLedgerTransaction) => Promise<T>,
  ): Promise<T>;
}
