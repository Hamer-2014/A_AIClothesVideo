import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  appearancePackAssets,
  appearancePackVideoBridges,
  appearancePacks,
  assetRightsAttestations,
  assets,
  garmentFidelityResults,
  rightsAttestations,
  videoJobs,
  virtualTryonJobs,
} from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import { stylePresets } from "@/lib/presets";
import type { VideoAspectRatio } from "@/server/jobs/create-job";
import {
  createDrizzleVideoJobCreationStore,
  createInMemoryVideoJobCreationStore,
  createVideoJobWithAssets,
  type CreatedVideoJob,
  type JobCreatableAsset,
} from "@/server/jobs/create-job";

import type { AppearanceView, VirtualTryOnMode } from "./config";

const bridgeDurations = new Set([8, 16, 24, 32]);
const bridgeAspectRatios = new Set<VideoAspectRatio>(["9:16", "1:1", "16:9"]);
const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export type VirtualTryOnVideoBridgeRequest = {
  userId: string;
  jobId: string;
  packId: string;
  idempotencyKey: string;
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  presetId: string;
};

type SourceRight = { assetId: string; attestationId: string };
type QaResult = { scope: string; view: AppearanceView | null; verdict: string };
type CandidateView = {
  id: string;
  view: AppearanceView;
  providerStatus: string;
  r2Key: string | null;
  mimeType: string | null;
  fileSize: number | null;
  origin: string;
  provenance: JsonValue;
  materializedAssetId: string | null;
};

export type VirtualTryOnVideoBridgeCandidate = {
  jobId: string;
  userId: string;
  jobStatus: string;
  mode: VirtualTryOnMode;
  skuName: string | null;
  isTest: boolean;
  packId: string;
  version: number;
  packStatus: string;
  lockedAt: Date | null;
  requiredViews: AppearanceView[];
  qaResults: QaResult[];
  sourceRights: SourceRight[] | null;
  views: CandidateView[];
};

type BridgeRequestSnapshot = {
  appearancePackId: string;
  version?: number;
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  presetId: string;
};

type BridgeRecord = {
  id: string;
  status: string;
  requestSnapshot: JsonValue;
  videoJobId: string | null;
  videoJobStatus: string | null;
};

type MaterializeInput = {
  candidate: VirtualTryOnVideoBridgeCandidate;
  provenance: JsonValue;
};

interface VirtualTryOnVideoBridgeTransaction {
  reserveBridge(input: VirtualTryOnVideoBridgeRequest & { requestSnapshot: JsonValue }): Promise<{ record: BridgeRecord; created: boolean }>;
  findCandidate(input: { userId: string; jobId: string }): Promise<VirtualTryOnVideoBridgeCandidate | null>;
  lockSourceRights(input: { userId: string; sourceRights: SourceRight[] }): Promise<boolean>;
  materializeAssets(input: MaterializeInput): Promise<string[]>;
  createVideoJob(input: {
    candidate: VirtualTryOnVideoBridgeCandidate;
    request: VirtualTryOnVideoBridgeRequest;
    assetIds: string[];
    generationSourceSnapshot: JsonValue;
  }): Promise<CreatedVideoJob>;
  completeBridge(input: { bridgeId: string; videoJobId: string }): Promise<void>;
}

export interface VirtualTryOnVideoBridgeStore {
  transaction<T>(callback: (tx: VirtualTryOnVideoBridgeTransaction) => Promise<T>): Promise<T>;
}

function requestSnapshot(input: VirtualTryOnVideoBridgeRequest): BridgeRequestSnapshot {
  return {
    appearancePackId: input.packId,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
    presetId: input.presetId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requestMatches(snapshot: unknown, expected: BridgeRequestSnapshot) {
  return isRecord(snapshot)
    && snapshot.appearancePackId === expected.appearancePackId
    && snapshot.durationSeconds === expected.durationSeconds
    && snapshot.aspectRatio === expected.aspectRatio
    && snapshot.presetId === expected.presetId;
}

function assertRequest(input: VirtualTryOnVideoBridgeRequest) {
  if (
    !input.userId
    || !input.jobId
    || !input.packId
    || input.idempotencyKey.trim().length < 8
    || input.idempotencyKey.length > 128
    || !bridgeDurations.has(input.durationSeconds)
    || !bridgeAspectRatios.has(input.aspectRatio)
    || !stylePresets.some((preset) => preset.id === input.presetId)
  ) {
    throw new Error("invalid_video_bridge_input");
  }
}

function requiredViewsFor(mode: VirtualTryOnMode): AppearanceView[] {
  return mode === "front_only" ? ["front"] : ["front", "side", "back"];
}

function sameViews(actual: AppearanceView[], expected: AppearanceView[]) {
  return actual.length === expected.length && expected.every((view) => actual.includes(view));
}

function assertCandidate(candidate: VirtualTryOnVideoBridgeCandidate, input: VirtualTryOnVideoBridgeRequest) {
  if (candidate.packId !== input.packId) throw new Error("appearance_pack_not_latest");
  if (candidate.jobStatus !== "locked" || candidate.packStatus !== "locked" || !candidate.lockedAt) {
    throw new Error("appearance_pack_not_locked");
  }
  const requiredViews = requiredViewsFor(candidate.mode);
  if (!sameViews(candidate.requiredViews, requiredViews)) throw new Error("appearance_pack_asset_incomplete");
  if (!candidate.sourceRights?.length) throw new Error("appearance_pack_source_rights_revoked");

  const viewQaPassed = requiredViews.every((view) => candidate.qaResults.some((result) => result.scope === "view" && result.view === view && result.verdict === "pass"));
  const crossQaPassed = candidate.mode === "front_only" || candidate.qaResults.some((result) => result.scope === "cross_view" && result.view === null && result.verdict === "pass");
  if (!viewQaPassed || !crossQaPassed) throw new Error("appearance_pack_strict_qa_required");

  const completeViews = requiredViews.every((view) => {
    const asset = candidate.views.find((item) => item.view === view);
    return asset
      && asset.providerStatus === "succeeded"
      && typeof asset.r2Key === "string"
      && supportedImageTypes.has(asset.mimeType ?? "")
      && Number.isInteger(asset.fileSize)
      && (asset.fileSize ?? 0) > 0;
  });
  if (!completeViews || candidate.views.length !== requiredViews.length) throw new Error("appearance_pack_asset_incomplete");
}

function sourceRightsFromSnapshots(sourceSnapshot: unknown, rightsSnapshot: unknown): SourceRight[] | null {
  if (!isRecord(sourceSnapshot) || !isRecord(rightsSnapshot) || !isRecord(sourceSnapshot.sources) || !isRecord(rightsSnapshot.sources)) return null;
  const result: SourceRight[] = [];
  for (const role of ["front", "back", "detail"]) {
    const source = sourceSnapshot.sources[role];
    if (source === undefined) continue;
    const right = rightsSnapshot.sources[role];
    if (!isRecord(source) || !isRecord(right) || typeof source.assetId !== "string" || typeof right.attestationId !== "string") return null;
    result.push({ assetId: source.assetId, attestationId: right.attestationId });
  }
  return result.length ? result : null;
}

function fileExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export async function createVirtualTryOnVideo(
  input: VirtualTryOnVideoBridgeRequest,
  deps: { store: VirtualTryOnVideoBridgeStore; now?: Date },
) {
  assertRequest(input);
  const now = deps.now ?? new Date();
  const expectedSnapshot = requestSnapshot(input);

  return deps.store.transaction(async (tx) => {
    const reservation = await tx.reserveBridge({ ...input, requestSnapshot: expectedSnapshot as unknown as JsonValue });
    if (!reservation.created) {
      if (!requestMatches(reservation.record.requestSnapshot, expectedSnapshot)) throw new Error("video_bridge_idempotency_mismatch");
      if (reservation.record.status !== "completed" || !reservation.record.videoJobId) throw new Error("video_bridge_in_progress");
      return {
        videoJobId: reservation.record.videoJobId,
        status: reservation.record.videoJobStatus ?? "asset_analysis_queued",
        replayed: true,
      };
    }

    const candidate = await tx.findCandidate({ userId: input.userId, jobId: input.jobId });
    if (!candidate) throw new Error("appearance_pack_not_found");
    assertCandidate(candidate, input);
    if (!candidate.sourceRights || !(await tx.lockSourceRights({ userId: input.userId, sourceRights: candidate.sourceRights }))) {
      throw new Error("appearance_pack_source_rights_revoked");
    }

    const generationSourceSnapshot = {
      kind: "virtual_tryon_appearance_pack",
      virtualTryOnJobId: candidate.jobId,
      appearancePackId: candidate.packId,
      version: candidate.version,
      mode: candidate.mode,
      sourceRights: candidate.sourceRights,
      materializedAt: now.toISOString(),
    } satisfies JsonValue;
    const assetIds = await tx.materializeAssets({ candidate, provenance: generationSourceSnapshot });
    const videoJob = await tx.createVideoJob({ candidate, request: input, assetIds, generationSourceSnapshot });
    await tx.completeBridge({ bridgeId: reservation.record.id, videoJobId: videoJob.id });

    return { videoJobId: videoJob.id, status: videoJob.status, replayed: false };
  });
}

type InMemoryMaterializedAsset = JobCreatableAsset & {
  originalKey: string;
  metadata: JsonValue;
  rightsAttestationIds: string[];
};

export function createInMemoryVirtualTryOnVideoBridgeStore(initial: {
  candidates?: VirtualTryOnVideoBridgeCandidate[];
  sourceRightsLockValid?: boolean;
} = {}): VirtualTryOnVideoBridgeStore & {
  listMaterializedAssets(): InMemoryMaterializedAsset[];
  listVideoJobs(): CreatedVideoJob[];
} {
  const candidates = initial.candidates ?? [];
  const materializedAssets: InMemoryMaterializedAsset[] = [];
  const videoStore = createInMemoryVideoJobCreationStore([]);
  const bridges: Array<BridgeRecord & { userId: string; key: string }> = [];
  let nextId = 1;

  const tx: VirtualTryOnVideoBridgeTransaction = {
    async reserveBridge(input) {
      const existing = bridges.find((bridge) => bridge.userId === input.userId && bridge.key === input.idempotencyKey);
      if (existing) {
        const videoJob = existing.videoJobId ? videoStore.listJobs().find((job) => job.id === existing.videoJobId) : null;
        return { record: { ...existing, videoJobStatus: videoJob?.status ?? null }, created: false };
      }
      const record = { id: `bridge-${nextId++}`, userId: input.userId, key: input.idempotencyKey, status: "creating", requestSnapshot: input.requestSnapshot, videoJobId: null, videoJobStatus: null };
      bridges.push(record);
      return { record, created: true };
    },
    async findCandidate(input) {
      return candidates.find((candidate) => candidate.userId === input.userId && candidate.jobId === input.jobId) ?? null;
    },
    async lockSourceRights(input) {
      return initial.sourceRightsLockValid !== false && input.sourceRights.length > 0;
    },
    async materializeAssets({ candidate, provenance }) {
      const rightsAttestationIds = Array.from(new Set(candidate.sourceRights?.map((right) => right.attestationId) ?? []));
      return candidate.requiredViews.map((view) => {
        const packAsset = candidate.views.find((asset) => asset.view === view)!;
        if (packAsset.materializedAssetId) return packAsset.materializedAssetId;
        const id = `materialized-${nextId++}`;
        packAsset.materializedAssetId = id;
        const asset: InMemoryMaterializedAsset = {
          id,
          userId: candidate.userId,
          status: "uploaded",
          detectedRole: view,
          rightsAttested: true,
          rightsAttestationId: rightsAttestationIds[0] ?? null,
          originalKey: packAsset.r2Key!,
          metadata: { generationSource: provenance, appearancePackAssetId: packAsset.id, view },
          rightsAttestationIds,
        };
        materializedAssets.push(asset);
        videoStore.addAsset(asset);
        return id;
      });
    },
    async createVideoJob({ candidate, request, assetIds, generationSourceSnapshot }) {
      const result = await createVideoJobWithAssets({
        store: videoStore,
        userId: request.userId,
        assetIds,
        durationSeconds: request.durationSeconds,
        aspectRatio: request.aspectRatio,
        useFreeTrialIfAvailable: false,
        isTest: candidate.isTest,
        presetId: request.presetId,
        captureProtocol: "model_turn",
        enforceCaptureProtocol: false,
        skuName: candidate.skuName,
        postQaModeOverride: "strict",
        generationSourceSnapshot,
      });
      return result.job;
    },
    async completeBridge({ bridgeId, videoJobId }) {
      const bridge = bridges.find((item) => item.id === bridgeId);
      if (!bridge) throw new Error("video_bridge_not_found");
      bridge.status = "completed";
      bridge.videoJobId = videoJobId;
      bridge.videoJobStatus = "asset_analysis_queued";
    },
  };

  return {
    async transaction(callback) { return callback(tx); },
    listMaterializedAssets: () => materializedAssets,
    listVideoJobs: () => videoStore.listJobs(),
  };
}

type RootDb = ReturnType<typeof getDb>;
type TxDb = Parameters<Parameters<RootDb["transaction"]>[0]>[0];

function createDrizzleBridgeTransaction(db: TxDb): VirtualTryOnVideoBridgeTransaction {
  return {
    async reserveBridge(input) {
      const [inserted] = await db.insert(appearancePackVideoBridges).values({
        userId: input.userId,
        virtualTryonJobId: input.jobId,
        appearancePackId: input.packId,
        idempotencyKey: input.idempotencyKey,
        requestSnapshot: input.requestSnapshot,
      }).onConflictDoNothing({ target: [appearancePackVideoBridges.userId, appearancePackVideoBridges.idempotencyKey] }).returning({ id: appearancePackVideoBridges.id });
      const [record] = await db.select({
        id: appearancePackVideoBridges.id,
        status: appearancePackVideoBridges.status,
        requestSnapshot: appearancePackVideoBridges.requestSnapshot,
        videoJobId: appearancePackVideoBridges.videoJobId,
        videoJobStatus: videoJobs.status,
      }).from(appearancePackVideoBridges)
        .leftJoin(videoJobs, eq(videoJobs.id, appearancePackVideoBridges.videoJobId))
        .where(and(eq(appearancePackVideoBridges.userId, input.userId), eq(appearancePackVideoBridges.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (!record) throw new Error("video_bridge_reservation_failed");
      return { record, created: Boolean(inserted) };
    },
    async findCandidate(input) {
      const [job] = await db.select({
        id: virtualTryonJobs.id,
        userId: virtualTryonJobs.userId,
        status: virtualTryonJobs.status,
        mode: virtualTryonJobs.mode,
        skuName: virtualTryonJobs.skuName,
        isTest: virtualTryonJobs.isTest,
        sourceSnapshot: virtualTryonJobs.sourceSnapshot,
        rightsSnapshot: virtualTryonJobs.rightsSnapshot,
      }).from(virtualTryonJobs).where(and(eq(virtualTryonJobs.id, input.jobId), eq(virtualTryonJobs.userId, input.userId), isNull(virtualTryonJobs.deletedAt))).limit(1);
      if (!job) return null;
      const [pack] = await db.select().from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, job.id)).orderBy(desc(appearancePacks.version)).limit(1);
      if (!pack) return null;
      const packViews = await db.select().from(appearancePackAssets).where(eq(appearancePackAssets.appearancePackId, pack.id));
      const qaResults = await db.select({ scope: garmentFidelityResults.scope, view: garmentFidelityResults.view, verdict: garmentFidelityResults.verdict }).from(garmentFidelityResults).where(eq(garmentFidelityResults.appearancePackId, pack.id));
      const expectedRights = sourceRightsFromSnapshots(job.sourceSnapshot, job.rightsSnapshot);
      let sourceRights: SourceRight[] | null = null;
      if (expectedRights) {
        const rows = await db.select({ assetId: assets.id, attestationId: rightsAttestations.id })
          .from(assets)
          .innerJoin(assetRightsAttestations, eq(assetRightsAttestations.assetId, assets.id))
          .innerJoin(rightsAttestations, eq(rightsAttestations.id, assetRightsAttestations.rightsAttestationId))
          .where(and(
            eq(assets.userId, input.userId),
            isNull(assets.deletedAt),
            eq(rightsAttestations.userId, input.userId),
            eq(rightsAttestations.version, "image_rights_v1"),
            isNull(rightsAttestations.redactedAt),
            inArray(assets.id, expectedRights.map((right) => right.assetId)),
          ));
        if (expectedRights.every((right) => rows.some((row) => row.assetId === right.assetId && row.attestationId === right.attestationId))) sourceRights = expectedRights;
      }
      const requiredViews = Array.isArray(pack.requiredViews) ? pack.requiredViews.filter((view): view is AppearanceView => view === "front" || view === "side" || view === "back") : [];
      return {
        jobId: job.id,
        userId: job.userId,
        jobStatus: job.status,
        mode: job.mode,
        skuName: job.skuName,
        isTest: job.isTest,
        packId: pack.id,
        version: pack.version,
        packStatus: pack.status,
        lockedAt: pack.lockedAt,
        requiredViews,
        qaResults,
        sourceRights,
        views: packViews.map((view) => ({
          id: view.id,
          view: view.view,
          providerStatus: view.providerStatus,
          r2Key: view.r2Key,
          mimeType: view.mimeType,
          fileSize: view.fileSize,
          origin: view.origin,
          provenance: view.provenance,
          materializedAssetId: view.materializedAssetId,
        })),
      };
    },
    async lockSourceRights(input) {
      if (!input.sourceRights.length) return false;
      const rows = await db.select({ assetId: assets.id, attestationId: rightsAttestations.id })
        .from(assets)
        .innerJoin(assetRightsAttestations, eq(assetRightsAttestations.assetId, assets.id))
        .innerJoin(rightsAttestations, eq(rightsAttestations.id, assetRightsAttestations.rightsAttestationId))
        .where(and(
          eq(assets.userId, input.userId),
          isNull(assets.deletedAt),
          eq(rightsAttestations.userId, input.userId),
          eq(rightsAttestations.version, "image_rights_v1"),
          isNull(rightsAttestations.redactedAt),
          inArray(assets.id, input.sourceRights.map((right) => right.assetId)),
          inArray(rightsAttestations.id, input.sourceRights.map((right) => right.attestationId)),
        ))
        .for("update");
      return input.sourceRights.every((right) => rows.some((row) => (
        row.assetId === right.assetId && row.attestationId === right.attestationId
      )));
    },
    async materializeAssets({ candidate, provenance }) {
      const result: string[] = [];
      const attestationIds = Array.from(new Set(candidate.sourceRights?.map((right) => right.attestationId) ?? []));
      for (const view of candidate.requiredViews) {
        const packAsset = candidate.views.find((asset) => asset.view === view);
        if (!packAsset?.r2Key || !packAsset.mimeType || !packAsset.fileSize) throw new Error("appearance_pack_asset_incomplete");
        if (packAsset.materializedAssetId) {
          const [existing] = await db.select({ id: assets.id, originalKey: assets.originalKey }).from(assets).where(and(eq(assets.id, packAsset.materializedAssetId), eq(assets.userId, candidate.userId), isNull(assets.deletedAt))).limit(1);
          if (!existing || existing.originalKey !== packAsset.r2Key) throw new Error("appearance_pack_materialized_asset_invalid");
          result.push(existing.id);
          continue;
        }
        const [materialized] = await db.insert(assets).values({
          userId: candidate.userId,
          status: "uploaded",
          originalKey: packAsset.r2Key,
          fileName: `appearance-pack-v${candidate.version}-${view}.${fileExtension(packAsset.mimeType)}`,
          mimeType: packAsset.mimeType,
          fileSize: packAsset.fileSize,
          detectedRole: view,
          metadata: {
            generationSource: provenance,
            appearancePackAssetId: packAsset.id,
            view,
            origin: packAsset.origin,
            providerProvenance: packAsset.provenance,
          },
        }).returning({ id: assets.id });
        if (!materialized) throw new Error("appearance_pack_materialization_failed");
        if (attestationIds.length) {
          await db.insert(assetRightsAttestations).values(attestationIds.map((rightsAttestationId) => ({ assetId: materialized.id, rightsAttestationId }))).onConflictDoNothing();
        }
        const [linked] = await db.update(appearancePackAssets).set({ materializedAssetId: materialized.id, updatedAt: new Date() }).where(and(eq(appearancePackAssets.id, packAsset.id), eq(appearancePackAssets.appearancePackId, candidate.packId), isNull(appearancePackAssets.materializedAssetId))).returning({ id: appearancePackAssets.id });
        if (!linked) throw new Error("appearance_pack_materialization_conflict");
        result.push(materialized.id);
      }
      return result;
    },
    async createVideoJob({ candidate, request, assetIds, generationSourceSnapshot }) {
      const result = await createVideoJobWithAssets({
        store: createDrizzleVideoJobCreationStore(db),
        userId: request.userId,
        assetIds,
        durationSeconds: request.durationSeconds,
        aspectRatio: request.aspectRatio,
        useFreeTrialIfAvailable: false,
        isTest: candidate.isTest,
        presetId: request.presetId,
        captureProtocol: "model_turn",
        enforceCaptureProtocol: false,
        skuName: candidate.skuName,
        postQaModeOverride: "strict",
        generationSourceSnapshot,
        requestContext: { path: `/api/virtual-try-on/${candidate.jobId}/video` },
      });
      return result.job;
    },
    async completeBridge(input) {
      const [updated] = await db.update(appearancePackVideoBridges).set({ status: "completed", videoJobId: input.videoJobId, errorCode: null, updatedAt: new Date() }).where(and(eq(appearancePackVideoBridges.id, input.bridgeId), eq(appearancePackVideoBridges.status, "creating"), isNull(appearancePackVideoBridges.videoJobId))).returning({ id: appearancePackVideoBridges.id });
      if (!updated) throw new Error("video_bridge_completion_failed");
    },
  };
}

export function createDrizzleVirtualTryOnVideoBridgeStore(db: RootDb = getDb()): VirtualTryOnVideoBridgeStore {
  return {
    async transaction(callback) {
      return db.transaction((tx) => callback(createDrizzleBridgeTransaction(tx)));
    },
  };
}
