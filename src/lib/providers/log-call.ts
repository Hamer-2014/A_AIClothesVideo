import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { providerCallLogs } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type {
  providerCallStatusValues,
  providerPurposeValues,
} from "@/lib/db/schema/providers";

export type ProviderPurpose = (typeof providerPurposeValues)[number];
export type ProviderCallStatus = (typeof providerCallStatusValues)[number];

export interface ProviderCallLogRecord {
  id: string;
  provider: string;
  providerKeyId: string | null;
  modelRouteId: string | null;
  routeSnapshot: JsonValue | null;
  model: string;
  purpose: ProviderPurpose;
  userId: string | null;
  videoJobId: string | null;
  segmentId: string | null;
  requestSnapshot: JsonValue;
  responseSummary: JsonValue | null;
  costEstimate: string;
  durationMs: number | null;
  status: ProviderCallStatus;
  fallbackReason: string | null;
  providerTaskId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewProviderCallLog {
  provider: string;
  providerKeyId?: string | null;
  modelRouteId?: string | null;
  routeSnapshot?: JsonValue | null;
  model: string;
  purpose: ProviderPurpose;
  userId?: string | null;
  videoJobId?: string | null;
  segmentId?: string | null;
  requestSnapshot: JsonValue;
  responseSummary?: JsonValue | null;
  costEstimate?: string;
  durationMs?: number | null;
  status: ProviderCallStatus;
  fallbackReason?: string | null;
  providerTaskId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface ProviderCallLogStore {
  createCallLog(input: NewProviderCallLog): Promise<ProviderCallLogRecord>;
  findCallLog?(callLogId: string): Promise<ProviderCallLogRecord | null>;
}

function normalizeProviderCallLog(input: NewProviderCallLog) {
  return {
    provider: input.provider,
    providerKeyId: input.providerKeyId ?? null,
    modelRouteId: input.modelRouteId ?? null,
    routeSnapshot: input.routeSnapshot ?? null,
    model: input.model,
    purpose: input.purpose,
    userId: input.userId ?? null,
    videoJobId: input.videoJobId ?? null,
    segmentId: input.segmentId ?? null,
    requestSnapshot: input.requestSnapshot,
    responseSummary: input.responseSummary ?? null,
    costEstimate: input.costEstimate ?? "0",
    durationMs: input.durationMs ?? null,
    status: input.status,
    fallbackReason: input.fallbackReason ?? null,
    providerTaskId: input.providerTaskId ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
  };
}

export function createInMemoryProviderCallLogStore(): ProviderCallLogStore & {
  listCallLogs: () => ProviderCallLogRecord[];
} {
  const logs: ProviderCallLogRecord[] = [];

  return {
    async createCallLog(input) {
      const now = new Date();
      const record: ProviderCallLogRecord = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...normalizeProviderCallLog(input),
      };
      logs.push(record);
      return record;
    },
    listCallLogs() {
      return logs;
    },
    async findCallLog(callLogId) {
      return logs.find((log) => log.id === callLogId) ?? null;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleProviderCallLogStore(
  db: DbClient = getDb(),
): ProviderCallLogStore {
  return {
    async createCallLog(input) {
      const [record] = await db
        .insert(providerCallLogs)
        .values(normalizeProviderCallLog(input))
        .returning();

      if (!record) {
        throw new Error("Failed to create provider call log.");
      }

      return record as ProviderCallLogRecord;
    },
    async findCallLog(callLogId) {
      const [record] = await db
        .select()
        .from(providerCallLogs)
        .where(eq(providerCallLogs.id, callLogId))
        .limit(1);

      return (record as ProviderCallLogRecord | undefined) ?? null;
    },
  };
}
