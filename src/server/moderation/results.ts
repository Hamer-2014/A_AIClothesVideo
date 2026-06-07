import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { promptModerationResults } from "@/lib/db/schema";
import type { moderationDecisionValues } from "@/lib/db/schema/providers";

type ModerationDecision = (typeof moderationDecisionValues)[number];

export interface ModerationResultRecord {
  id: string;
  userId: string;
  videoJobId: string | null;
  segmentId: string | null;
  source: string;
  promptHash: string;
  promptSummary: string | null;
  externalId: string | null;
  moderationId: string | null;
  decision: ModerationDecision;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  providerCallLogId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewModerationResult {
  userId: string;
  videoJobId?: string | null;
  segmentId?: string | null;
  source: string;
  promptHash: string;
  promptSummary?: string | null;
  externalId?: string | null;
  moderationId?: string | null;
  decision: ModerationDecision;
  errorCode?: string | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
  providerCallLogId?: string | null;
}

export interface ModerationResultStore {
  createResult(input: NewModerationResult): Promise<ModerationResultRecord>;
}

export function createInMemoryModerationResultStore(): ModerationResultStore & {
  listResults: () => ModerationResultRecord[];
} {
  const results: ModerationResultRecord[] = [];

  return {
    async createResult(input) {
      const now = new Date();
      const result: ModerationResultRecord = {
        id: randomUUID(),
        videoJobId: input.videoJobId ?? null,
        segmentId: input.segmentId ?? null,
        promptSummary: input.promptSummary ?? null,
        externalId: input.externalId ?? null,
        moderationId: input.moderationId ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        latencyMs: input.latencyMs ?? null,
        providerCallLogId: input.providerCallLogId ?? null,
        createdAt: now,
        updatedAt: now,
        ...input,
      };
      results.push(result);
      return result;
    },
    listResults() {
      return results;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleModerationResultStore(
  db: DbClient = getDb(),
): ModerationResultStore {
  return {
    async createResult(input) {
      const [result] = await db
        .insert(promptModerationResults)
        .values({
          userId: input.userId,
          videoJobId: input.videoJobId ?? null,
          segmentId: input.segmentId ?? null,
          source: input.source,
          promptHash: input.promptHash,
          promptSummary: input.promptSummary ?? null,
          externalId: input.externalId ?? null,
          moderationId: input.moderationId ?? null,
          decision: input.decision,
          errorCode: input.errorCode ?? null,
          errorMessage: input.errorMessage ?? null,
          latencyMs: input.latencyMs ?? null,
          providerCallLogId: input.providerCallLogId ?? null,
        })
        .returning();

      if (!result) {
        throw new Error("Failed to create prompt moderation result.");
      }

      return result as ModerationResultRecord;
    },
  };
}
