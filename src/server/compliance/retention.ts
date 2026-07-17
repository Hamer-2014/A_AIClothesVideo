import {
  and,
  eq,
  inArray,
  isNull,
  lt,
  notExists,
} from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  assetRightsAttestations,
  assets,
  rightsAttestations,
  rightsRemovalRequests,
} from "@/lib/db/schema";
import type { RightsRemovalRequestRecord } from "./rights-removal";

export const COMPLIANCE_RETENTION_YEARS = 3;

export interface ComplianceRetentionStore {
  redactExpiredRemovalRequests(input: {
    cutoff: Date;
    redactedAt: Date;
    limit: number;
  }): Promise<number>;
  redactExpiredAttestations(input: {
    cutoff: Date;
    redactedAt: Date;
    limit: number;
  }): Promise<number>;
}

export interface ComplianceRetentionAttestationRecord {
  id: string;
  userId: string;
  acceptedAt: Date;
  ipHash: string | null;
  userAgentHash: string | null;
  redactedAt: Date | null;
  linkedAssetDeletedAt: Array<Date | null>;
}

export async function redactExpiredComplianceData({
  store,
  now = new Date(),
  limit = 100,
}: {
  store: ComplianceRetentionStore;
  now?: Date;
  limit?: number;
}) {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - COMPLIANCE_RETENTION_YEARS);
  const removalRequestCount = await store.redactExpiredRemovalRequests({
    cutoff,
    redactedAt: now,
    limit: normalizedLimit,
  });
  const attestationCount = await store.redactExpiredAttestations({
    cutoff,
    redactedAt: now,
    limit: normalizedLimit,
  });
  return { removalRequestCount, attestationCount };
}

export function createInMemoryComplianceRetentionStore(input: {
  removalRequests?: RightsRemovalRequestRecord[];
  attestations?: ComplianceRetentionAttestationRecord[];
}): ComplianceRetentionStore & {
  listRemovalRequests(): RightsRemovalRequestRecord[];
  listAttestations(): ComplianceRetentionAttestationRecord[];
} {
  const removalRequests = (input.removalRequests ?? []).map((record) => ({
    ...record,
  }));
  const attestations = (input.attestations ?? []).map((record) => ({
    ...record,
    linkedAssetDeletedAt: [...record.linkedAssetDeletedAt],
  }));

  return {
    async redactExpiredRemovalRequests({ cutoff, redactedAt, limit }) {
      const candidates = removalRequests
        .filter(
          (record) =>
            record.redactedAt === null &&
            (record.status === "resolved_removed" ||
              record.status === "resolved_rejected") &&
            record.resolvedAt !== null &&
            record.resolvedAt < cutoff,
        )
        .slice(0, limit);
      for (const record of candidates) {
        Object.assign(record, {
          reporterName: "[REDACTED]",
          reporterEmail: "[REDACTED]",
          contentReferences: [],
          description: "[REDACTED]",
          ipHash: null,
          userAgentHash: null,
          redactedAt,
          updatedAt: redactedAt,
        });
      }
      return candidates.length;
    },
    async redactExpiredAttestations({ cutoff, redactedAt, limit }) {
      const candidates = attestations
        .filter(
          (record) =>
            record.redactedAt === null &&
            record.acceptedAt < cutoff &&
            record.linkedAssetDeletedAt.every((deletedAt) => deletedAt !== null),
        )
        .slice(0, limit);
      for (const record of candidates) {
        Object.assign(record, {
          userId: "[REDACTED]",
          ipHash: null,
          userAgentHash: null,
          redactedAt,
        });
      }
      return candidates.length;
    },
    listRemovalRequests: () =>
      removalRequests.map((record) => ({ ...record })),
    listAttestations: () =>
      attestations.map((record) => ({
        ...record,
        linkedAssetDeletedAt: [...record.linkedAssetDeletedAt],
      })),
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleComplianceRetentionStore(
  db: DbClient = getDb(),
): ComplianceRetentionStore {
  return {
    async redactExpiredRemovalRequests({ cutoff, redactedAt, limit }) {
      const candidates = await db
        .select({ id: rightsRemovalRequests.id })
        .from(rightsRemovalRequests)
        .where(
          and(
            isNull(rightsRemovalRequests.redactedAt),
            inArray(rightsRemovalRequests.status, [
              "resolved_removed",
              "resolved_rejected",
            ]),
            lt(rightsRemovalRequests.resolvedAt, cutoff),
          ),
        )
        .limit(limit);
      const ids = candidates.map((candidate) => candidate.id);
      if (ids.length === 0) {
        return 0;
      }
      await db
        .update(rightsRemovalRequests)
        .set({
          reporterName: "[REDACTED]",
          reporterEmail: "[REDACTED]",
          contentReferences: [],
          description: "[REDACTED]",
          ipHash: null,
          userAgentHash: null,
          redactedAt,
          updatedAt: redactedAt,
        })
        .where(inArray(rightsRemovalRequests.id, ids));
      return ids.length;
    },
    async redactExpiredAttestations({ cutoff, redactedAt, limit }) {
      const activeAsset = db
        .select({ id: assetRightsAttestations.id })
        .from(assetRightsAttestations)
        .innerJoin(assets, eq(assetRightsAttestations.assetId, assets.id))
        .where(
          and(
            eq(
              assetRightsAttestations.rightsAttestationId,
              rightsAttestations.id,
            ),
            isNull(assets.deletedAt),
          ),
        );
      const candidates = await db
        .select({ id: rightsAttestations.id })
        .from(rightsAttestations)
        .where(
          and(
            isNull(rightsAttestations.redactedAt),
            lt(rightsAttestations.acceptedAt, cutoff),
            notExists(activeAsset),
          ),
        )
        .limit(limit);
      const ids = candidates.map((candidate) => candidate.id);
      if (ids.length === 0) {
        return 0;
      }
      await db
        .update(rightsAttestations)
        .set({
          userId: "[REDACTED]",
          ipHash: null,
          userAgentHash: null,
          redactedAt,
        })
        .where(inArray(rightsAttestations.id, ids));
      return ids.length;
    },
  };
}
