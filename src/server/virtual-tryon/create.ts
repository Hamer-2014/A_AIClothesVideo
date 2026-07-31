import { reserveCredits } from "@/lib/credits/ledger";
import type { CreditLedgerStore } from "@/lib/credits/types";
import type { JsonValue } from "@/lib/db/schema/common";
import { checkPrompt } from "@/server/moderation/check-prompt";

import { getVirtualTryOnConfig, requiredViewsFor, type VirtualTryOnMode } from "./config";
import type { SourceAsset, TryOnJob, TryOnPack, VirtualTryOnStore } from "./store";

type SourceRole = "front" | "back" | "detail";
type SourceInput = { front: string; back?: string; detail?: string };

function selectedSources(input: SourceInput): Array<[SourceRole, string]> {
  return (["front", "back", "detail"] as const).flatMap((role) => input[role] ? [[role, input[role]!]] : []);
}

function samePayload(job: TryOnJob, input: { mode: VirtualTryOnMode; sourceAssetIds: SourceInput }) {
  if (job.mode !== input.mode || !job.sourceSnapshot || typeof job.sourceSnapshot !== "object" || Array.isArray(job.sourceSnapshot)) return false;
  const sources = (job.sourceSnapshot as { sources?: unknown }).sources;
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return false;
  const requested = selectedSources(input.sourceAssetIds);
  return requested.length === Object.keys(sources).length && requested.every(([role, assetId]) => {
    const value = (sources as Record<string, unknown>)[role];
    return Boolean(value && typeof value === "object" && (value as { assetId?: unknown }).assetId === assetId);
  });
}

function snapshots(input: SourceInput, assetsById: Map<string, SourceAsset>) {
  const sourceEntries = selectedSources(input).map(([role, assetId]) => {
    const asset = assetsById.get(assetId);
    if (!asset) throw new Error("virtual_tryon_asset_rights_required");
    if (asset.detectedRole !== role) throw new Error("virtual_tryon_asset_role_mismatch");
    return [role, { assetId: asset.id, key: asset.originalKey }] as const;
  });
  const rightsEntries = selectedSources(input).map(([role, assetId]) => {
    const asset = assetsById.get(assetId);
    if (!asset) throw new Error("virtual_tryon_asset_rights_required");
    return [role, { assetId: asset.id, originalKey: asset.originalKey, attestationId: asset.rightsAttestationId, version: asset.rightsAttestationVersion, acceptedAt: asset.rightsAttestationAcceptedAt.toISOString() }] as const;
  });
  return { sourceSnapshot: { sources: Object.fromEntries(sourceEntries) } as JsonValue, rightsSnapshot: { sources: Object.fromEntries(rightsEntries) } as JsonValue };
}

function isInsufficientBalance(error: unknown) {
  return error instanceof Error && error.message === "Insufficient available credits.";
}

async function reserveDraft(input: { result: { job: TryOnJob; pack: TryOnPack }; creditStore: CreditLedgerStore; store: VirtualTryOnStore }) {
  const { result, creditStore, store } = input;
  try {
    const reserved = await reserveCredits({ store: creditStore, userId: result.job.userId, amount: result.job.creditCost, reason: "virtual_tryon_reserve", relatedJobId: result.job.id, idempotencyKey: "virtual-tryon:" + result.job.id + ":reserve" });
    const queued = await store.queueDraft({ jobId: result.job.id, reservedLedgerId: reserved.ledger.id });
    if (queued) return { ...result, job: { ...result.job, status: "queued", reservedLedgerId: reserved.ledger.id } };
    const current = await store.findByIdempotency({ userId: result.job.userId, key: result.job.createIdempotencyKey });
    if (current && current.job.status !== "draft") return current;
    throw new Error("virtual_tryon_queue_transition_failed");
  } catch (error) {
    if (isInsufficientBalance(error)) {
      await store.failDraft({ jobId: result.job.id, error: "insufficient_available_credits" });
      throw error;
    }
    await store.scheduleDraftRetry({ jobId: result.job.id, error: error instanceof Error ? error.message : "reserve_failed", nextRetryAt: new Date(Date.now() + 30_000) });
    throw new Error("virtual_tryon_reserve_retry_scheduled");
  }
}

export async function createVirtualTryOn(input: { userId: string; key: string; mode: VirtualTryOnMode; skuName?: string; sourceAssetIds: SourceInput }, deps: { store: VirtualTryOnStore; creditStore: CreditLedgerStore; env?: Record<string, string | undefined>; moderate?: typeof checkPrompt }) {
  const selected = selectedSources(input.sourceAssetIds);
  const sourceIds = selected.map(([, assetId]) => assetId);
  if (new Set(sourceIds).size !== sourceIds.length) throw new Error("virtual_tryon_duplicate_source_asset");

  const existing = await deps.store.findByIdempotency({ userId: input.userId, key: input.key });
  if (existing) {
    if (!samePayload(existing.job, input)) throw new Error("virtual_tryon_idempotency_conflict");
    if (existing.job.status === "failed_unreserved") throw new Error("virtual_tryon_failed_unreserved");
    if (existing.job.status !== "draft") return existing;
    return reserveDraft({ result: existing, creditStore: deps.creditStore, store: deps.store });
  }

  const config = getVirtualTryOnConfig(deps.env);
  const requiredViews = requiredViewsFor({ mode: input.mode, frontAssetId: input.sourceAssetIds.front, backAssetId: input.sourceAssetIds.back ?? null, detailAssetId: input.sourceAssetIds.detail ?? null });
  const sources = await deps.store.findOwnedSources({ userId: input.userId, assetIds: sourceIds });
  if (sources.length !== sourceIds.length) throw new Error("virtual_tryon_asset_rights_required");
  const sourceById = new Map(sources.map((asset) => [asset.id, asset]));
  const { sourceSnapshot, rightsSnapshot } = snapshots(input.sourceAssetIds, sourceById);
  const moderate = deps.moderate ?? checkPrompt;
  const moderation = await moderate({ userId: input.userId, source: "virtual_tryon_generation", prompt: "Generate a static AI model garment appearance pack." });
  if (!moderation.allowed) throw new Error("virtual_tryon_moderation_blocked");
  const creditCost = input.mode === "front_only" ? config.frontOnlyCreditCost : config.threeViewCreditCost;
  const result = await deps.store.createJobAndPack({ userId: input.userId, mode: input.mode, skuName: input.skuName, key: input.key, creditCost, requiredViews, sourceSnapshot, modelSnapshot: config.modelKeys as JsonValue, rightsSnapshot });
  if (!samePayload(result.job, input)) throw new Error("virtual_tryon_idempotency_conflict");
  if (result.job.status === "failed_unreserved") throw new Error("virtual_tryon_failed_unreserved");
  if (result.job.status !== "draft") return result;
  return reserveDraft({ result, creditStore: deps.creditStore, store: deps.store });
}
