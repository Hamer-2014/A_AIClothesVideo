import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  assetRightsAttestations,
  assets,
  rightsAttestations,
} from "@/lib/db/schema";
import type { AssetRole } from "@/server/assets/analysis-schema";
import { hashAbuseSignal } from "@/server/abuse/hash";

export const CURRENT_RIGHTS_ATTESTATION_VERSION = "image_rights_v1" as const;
export const CURRENT_RIGHTS_ATTESTATION_STATEMENT =
  "我确认拥有或已获得上传素材的版权、商标及商业使用授权；如素材包含可识别人物，我已获得其肖像和商业宣传授权；如人物未满 18 周岁，我已获得其监护人授权。我不会将素材或生成结果用于冒充代言、色情化、政治宣传或其他违法误导用途。";

export type ParsedRightsAttestation = {
  accepted: true;
  version: typeof CURRENT_RIGHTS_ATTESTATION_VERSION;
};

export type RightsAttestationScope = "upload" | "generation_reconfirmation";

export interface RightsAttestationAssetInput {
  id: string;
  key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  detectedRole: AssetRole;
  status: "pending_upload";
}

export interface CreateAttestationWithAssetsInput {
  userId: string;
  attestation: ParsedRightsAttestation;
  scope: RightsAttestationScope;
  locale: string;
  ipAddress: string | null;
  userAgent: string | null;
  files: RightsAttestationAssetInput[];
}

export interface CreateAttestationWithAssetsResult {
  attestationId: string;
  assets: Array<{ id: string; key: string }>;
}

export interface RightsAttestationStore {
  createAttestationWithAssets(
    input: CreateAttestationWithAssetsInput,
  ): Promise<CreateAttestationWithAssetsResult>;
  attestExistingAssets(input: AttestExistingAssetsStoreInput): Promise<{
    attestationId: string;
    assetIds: string[];
  }>;
}

export interface AttestExistingAssetsStoreInput {
  userId: string;
  assetIds: string[];
  version: typeof CURRENT_RIGHTS_ATTESTATION_VERSION;
  statementSnapshot: string;
  locale: string;
  ipHash: string | null;
  userAgentHash: string | null;
  acceptedAt: Date;
}

export interface AttestAssetsInput {
  userId: string;
  assetIds: string[];
  attestation: ParsedRightsAttestation;
  locale: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface StoredRightsAttestation {
  id: string;
  userId: string;
  version: typeof CURRENT_RIGHTS_ATTESTATION_VERSION;
  statementSnapshot: string;
  scope: RightsAttestationScope;
  locale: string;
  ipHash: string | null;
  userAgentHash: string | null;
  acceptedAt: Date;
  createdAt: Date;
  redactedAt: Date | null;
}

interface StoredRightsAsset extends RightsAttestationAssetInput {
  userId: string;
}

interface StoredAssetRightsLink {
  id: string;
  assetId: string;
  rightsAttestationId: string;
  createdAt: Date;
}

export function parseRightsAttestation(value: unknown): ParsedRightsAttestation {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  if (record.accepted !== true) {
    throw new Error("rights_attestation_required");
  }
  if (record.version !== CURRENT_RIGHTS_ATTESTATION_VERSION) {
    throw new Error("rights_attestation_version_mismatch");
  }

  return { accepted: true, version: CURRENT_RIGHTS_ATTESTATION_VERSION };
}

export function requireComplianceHashSecret(
  appEnvironment: string,
  secret: string | null | undefined,
) {
  const normalized = secret?.trim() || null;
  if (
    !normalized &&
    appEnvironment !== "development" &&
    appEnvironment !== "test"
  ) {
    throw new Error("compliance_hash_secret_required");
  }
  return normalized;
}

function validateAssetBatch(files: RightsAttestationAssetInput[]) {
  if (files.length === 0 || files.length > 8) {
    throw new Error("invalid_upload_batch");
  }
  if (new Set(files.map((file) => file.id)).size !== files.length) {
    throw new Error("invalid_upload_batch");
  }
}

function validateExistingAssetIds(assetIds: string[]) {
  if (
    assetIds.length === 0 ||
    assetIds.length > 8 ||
    new Set(assetIds).size !== assetIds.length ||
    assetIds.some((assetId) => !assetId.trim())
  ) {
    throw new Error("invalid_asset_ids");
  }
}

function buildStoredRecords(
  input: CreateAttestationWithAssetsInput,
  options: { environment: string; hashSecret: string | null | undefined },
) {
  validateAssetBatch(input.files);
  const secret = requireComplianceHashSecret(
    options.environment,
    options.hashSecret,
  );
  const now = new Date();
  const attestationId = randomUUID();
  const attestation: StoredRightsAttestation = {
    id: attestationId,
    userId: input.userId,
    version: input.attestation.version,
    statementSnapshot: CURRENT_RIGHTS_ATTESTATION_STATEMENT,
    scope: input.scope,
    locale: input.locale,
    ipHash: secret ? hashAbuseSignal(input.ipAddress, secret) : null,
    userAgentHash: secret ? hashAbuseSignal(input.userAgent, secret) : null,
    acceptedAt: now,
    createdAt: now,
    redactedAt: null,
  };
  const storedAssets: StoredRightsAsset[] = input.files.map((file) => ({
    ...file,
    userId: input.userId,
  }));
  const links: StoredAssetRightsLink[] = input.files.map((file) => ({
    id: randomUUID(),
    assetId: file.id,
    rightsAttestationId: attestationId,
    createdAt: now,
  }));

  return { attestation, storedAssets, links };
}

export function createDrizzleRightsAttestationStore(
  options: {
    environment?: string;
    hashSecret?: string | null;
  } = {},
): RightsAttestationStore {
  const environment =
    options.environment ??
    process.env.APP_ENV ??
    process.env.NODE_ENV ??
    "development";
  const hashSecret = options.hashSecret ?? process.env.ABUSE_HASH_SECRET;

  return {
    async createAttestationWithAssets(input) {
      const records = buildStoredRecords(input, { environment, hashSecret });
      const db = getDb();

      await db.transaction(async (transaction) => {
        await transaction.insert(rightsAttestations).values(records.attestation);
        await transaction.insert(assets).values(
          records.storedAssets.map((asset) => ({
            id: asset.id,
            userId: asset.userId,
            status: asset.status,
            originalKey: asset.key,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            fileSize: asset.fileSize,
            detectedRole: asset.detectedRole,
            metadata: {
              intendedRole: asset.detectedRole,
              uploadState: asset.status,
            },
          })),
        );
        await transaction.insert(assetRightsAttestations).values(records.links);
      });

      return {
        attestationId: records.attestation.id,
        assets: records.storedAssets.map((asset) => ({
          id: asset.id,
          key: asset.key,
        })),
      };
    },
    async attestExistingAssets(input) {
      validateExistingAssetIds(input.assetIds);
      const db = getDb();

      return db.transaction(async (transaction) => {
        const ownedAssets = await transaction
          .select({ id: assets.id })
          .from(assets)
          .where(
            and(
              eq(assets.userId, input.userId),
              inArray(assets.id, input.assetIds),
              isNull(assets.deletedAt),
            ),
          );

        if (ownedAssets.length !== input.assetIds.length) {
          throw new Error("rights_attestation_asset_not_found");
        }

        const existingLinks = await transaction
          .select({
            assetId: assetRightsAttestations.assetId,
            attestationId: assetRightsAttestations.rightsAttestationId,
          })
          .from(assetRightsAttestations)
          .innerJoin(
            rightsAttestations,
            eq(
              assetRightsAttestations.rightsAttestationId,
              rightsAttestations.id,
            ),
          )
          .where(
            and(
              inArray(assetRightsAttestations.assetId, input.assetIds),
              eq(rightsAttestations.version, input.version),
            ),
          );
        const coveredIds = new Set(existingLinks.map((link) => link.assetId));
        if (input.assetIds.every((assetId) => coveredIds.has(assetId))) {
          return {
            attestationId: existingLinks[0]?.attestationId ?? "",
            assetIds: [...input.assetIds],
          };
        }

        const attestationId = randomUUID();
        await transaction.insert(rightsAttestations).values({
          id: attestationId,
          userId: input.userId,
          version: input.version,
          statementSnapshot: input.statementSnapshot,
          scope: "generation_reconfirmation",
          locale: input.locale,
          ipHash: input.ipHash,
          userAgentHash: input.userAgentHash,
          acceptedAt: input.acceptedAt,
        });
        await transaction.insert(assetRightsAttestations).values(
          input.assetIds.map((assetId) => ({
            id: randomUUID(),
            assetId,
            rightsAttestationId: attestationId,
          })),
        );

        return { attestationId, assetIds: [...input.assetIds] };
      });
    },
  };
}

export async function createAttestationWithAssets(
  input: CreateAttestationWithAssetsInput,
) {
  return createDrizzleRightsAttestationStore().createAttestationWithAssets(input);
}

export async function attestAssets(input: AttestAssetsInput) {
  validateExistingAssetIds(input.assetIds);
  const environment =
    process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
  const secret = requireComplianceHashSecret(
    environment,
    process.env.ABUSE_HASH_SECRET,
  );

  return createDrizzleRightsAttestationStore().attestExistingAssets({
    userId: input.userId,
    assetIds: input.assetIds,
    version: input.attestation.version,
    statementSnapshot: CURRENT_RIGHTS_ATTESTATION_STATEMENT,
    locale: input.locale,
    ipHash: secret ? hashAbuseSignal(input.ipAddress, secret) : null,
    userAgentHash: secret ? hashAbuseSignal(input.userAgent, secret) : null,
    acceptedAt: new Date(),
  });
}

export function createInMemoryRightsAttestationStore(
  options: {
    environment?: string;
    hashSecret?: string | null;
    existingAssets?: Array<{
      id: string;
      userId: string;
      status: string;
      deletedAt: Date | null;
    }>;
  } = {},
): RightsAttestationStore & {
  listAttestations(): StoredRightsAttestation[];
  listAssets(): StoredRightsAsset[];
  listLinks(): StoredAssetRightsLink[];
} {
  const environment = options.environment ?? "test";
  const hashSecret = options.hashSecret ?? "test-compliance-hash-secret";
  const attestations: StoredRightsAttestation[] = [];
  const storedAssets: StoredRightsAsset[] = [];
  const links: StoredAssetRightsLink[] = [];
  const knownAssets = new Map(
    (options.existingAssets ?? []).map((asset) => [asset.id, { ...asset }]),
  );

  return {
    async createAttestationWithAssets(input) {
      const records = buildStoredRecords(input, { environment, hashSecret });
      attestations.push(records.attestation);
      storedAssets.push(...records.storedAssets);
      links.push(...records.links);
      for (const asset of records.storedAssets) {
        knownAssets.set(asset.id, {
          id: asset.id,
          userId: asset.userId,
          status: asset.status,
          deletedAt: null,
        });
      }

      return {
        attestationId: records.attestation.id,
        assets: records.storedAssets.map((asset) => ({
          id: asset.id,
          key: asset.key,
        })),
      };
    },
    async attestExistingAssets(input) {
      validateExistingAssetIds(input.assetIds);
      const ownedAssets = input.assetIds.map((assetId) => knownAssets.get(assetId));
      if (
        ownedAssets.some(
          (asset) =>
            !asset ||
            asset.userId !== input.userId ||
            asset.deletedAt !== null ||
            asset.status === "deleted",
        )
      ) {
        throw new Error("rights_attestation_asset_not_found");
      }

      const currentAttestationIds = new Set(
        attestations
          .filter((attestation) => attestation.version === input.version)
          .map((attestation) => attestation.id),
      );
      const existingLinks = links.filter(
        (link) =>
          input.assetIds.includes(link.assetId) &&
          currentAttestationIds.has(link.rightsAttestationId),
      );
      const coveredIds = new Set(existingLinks.map((link) => link.assetId));
      if (input.assetIds.every((assetId) => coveredIds.has(assetId))) {
        return {
          attestationId: existingLinks[0]?.rightsAttestationId ?? "",
          assetIds: [...input.assetIds],
        };
      }

      const attestationId = randomUUID();
      const createdAt = input.acceptedAt;
      attestations.push({
        id: attestationId,
        userId: input.userId,
        version: input.version,
        statementSnapshot: input.statementSnapshot,
        scope: "generation_reconfirmation",
        locale: input.locale,
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        acceptedAt: input.acceptedAt,
        createdAt,
        redactedAt: null,
      });
      links.push(
        ...input.assetIds.map((assetId) => ({
          id: randomUUID(),
          assetId,
          rightsAttestationId: attestationId,
          createdAt,
        })),
      );

      return { attestationId, assetIds: [...input.assetIds] };
    },
    listAttestations: () => attestations.map((item) => ({ ...item })),
    listAssets: () => storedAssets.map((item) => ({ ...item })),
    listLinks: () => links.map((item) => ({ ...item })),
  };
}
