import { describe, expect, it } from "vitest";

import { grantTrialCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { createInMemoryVirtualTryOnStore, type SourceAsset } from "./store";
import { createVirtualTryOn } from "./create";

const env = { APIMART_API_KEY: "key", R2_ACCOUNT_ID: "id", R2_ACCESS_KEY_ID: "access", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", VIRTUAL_TRYON_MODEL_FRONT_KEY: "models/front.png", VIRTUAL_TRYON_MODEL_SIDE_KEY: "models/side.png", VIRTUAL_TRYON_MODEL_BACK_KEY: "models/back.png", VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST: "2", VIRTUAL_TRYON_THREE_VIEW_CREDIT_COST: "5" };
const source = (id: string, detectedRole: SourceAsset["detectedRole"] = "front", overrides: Partial<SourceAsset & { rightsAttestationRedactedAt: Date | null }> = {}): SourceAsset & { userId: string; rightsAttestationRedactedAt?: Date | null } => ({ id, userId: "user", originalKey: "assets/" + id + ".png", detectedRole, rightsAttestationId: "attestation-" + id, rightsAttestationVersion: "image_rights_v1", rightsAttestationAcceptedAt: new Date("2026-08-01T00:00:00.000Z"), ...overrides });

describe("create virtual try-on", () => {
  it("moderates before reserving a queued front-only job", async () => {
    const credits = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: credits, userId: "user", amount: 10, reason: "test", idempotencyKey: "grant" });
    const store = createInMemoryVirtualTryOnStore({ sources: [source("front")] });
    const order: string[] = [];
    const creditStore: CreditLedgerStore = { transaction: async (callback) => { order.push("reserve"); return credits.transaction(callback); } };
    const result = await createVirtualTryOn({ userId: "user", key: "idempotent", mode: "front_only", sourceAssetIds: { front: "front" } }, { store, creditStore, env, moderate: async () => { order.push("moderation"); return { allowed: true, decision: "allow", moderationId: "m", errorCode: null }; } });
    expect(result.job.status).toBe("queued");
    expect(order).toEqual(["moderation", "reserve"]);
    expect(credits.listLedger().map((entry) => entry.type)).toEqual(["trial_grant", "reserve"]);
    expect(store.listJobs()[0]?.sourceSnapshot).toEqual({ sources: { front: { assetId: "front", key: "assets/front.png" } } });
    expect((store.listJobs()[0] as { rightsSnapshot?: unknown }).rightsSnapshot).toEqual({ sources: { front: { assetId: "front", originalKey: "assets/front.png", attestationId: "attestation-front", version: "image_rights_v1", acceptedAt: "2026-08-01T00:00:00.000Z" } } });
    expect(store.listJobs()[0]?.reservedLedgerId).toBe(credits.listLedger().find((entry) => entry.type === "reserve")?.id);
    expect(store.listStateEvents()).toEqual([expect.objectContaining({ toStatus: "queued", reason: "reserve_succeeded", eventSnapshot: { reservedLedgerId: expect.any(String) } })]);
  });

  it("does not queue a job when reserve fails", async () => {
    const credits = createInMemoryCreditLedgerStore();
    const store = createInMemoryVirtualTryOnStore({ sources: [source("front")] });
    await expect(createVirtualTryOn({ userId: "user", key: "no-balance", mode: "front_only", sourceAssetIds: { front: "front" } }, { store, creditStore: credits, env, moderate: async () => ({ allowed: true, decision: "allow", moderationId: "m", errorCode: null }) })).rejects.toThrow("Insufficient available credits");
    expect(await store.findByIdempotency({ userId: "user", key: "no-balance" })).toMatchObject({ job: { status: "failed_unreserved" } });
  });

  it("rejects a source whose detected role does not match the requested role", async () => {
    const credits = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: credits, userId: "user", amount: 10, reason: "test", idempotencyKey: "grant" });
    const store = createInMemoryVirtualTryOnStore({ sources: [source("front", "detail")] });

    await expect(createVirtualTryOn({ userId: "user", key: "wrong-role", mode: "front_only", sourceAssetIds: { front: "front" } }, { store, creditStore: credits, env, moderate: async () => ({ allowed: true, decision: "allow", moderationId: "m", errorCode: null }) })).rejects.toThrow("virtual_tryon_asset_role_mismatch");
    expect(await store.findByIdempotency({ userId: "user", key: "wrong-role" })).toBeNull();
  });

  it("rejects an idempotency replay with a different payload", async () => {
    const credits = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: credits, userId: "user", amount: 10, reason: "test", idempotencyKey: "grant" });
    const store = createInMemoryVirtualTryOnStore({ sources: [
      source("front-a"),
      source("front-b"),
    ] });
    const deps = { store, creditStore: credits, env, moderate: async () => ({ allowed: true as const, decision: "allow" as const, moderationId: "m", errorCode: null }) };
    await createVirtualTryOn({ userId: "user", key: "same-key", mode: "front_only", sourceAssetIds: { front: "front-a" } }, deps);

    await expect(createVirtualTryOn({ userId: "user", key: "same-key", mode: "front_only", sourceAssetIds: { front: "front-b" } }, deps)).rejects.toThrow("virtual_tryon_idempotency_conflict");
  });

  it("keeps a draft recoverable when reserve has a temporary ledger error", async () => {
    const store = createInMemoryVirtualTryOnStore({ sources: [source("front")] });
    const temporaryLedger = { transaction: async () => { throw new Error("ledger_timeout"); } } as unknown as CreditLedgerStore;

    await expect(createVirtualTryOn({ userId: "user", key: "reserve-timeout", mode: "front_only", sourceAssetIds: { front: "front" } }, { store, creditStore: temporaryLedger, env, moderate: async () => ({ allowed: true, decision: "allow", moderationId: "m", errorCode: null }) })).rejects.toThrow("virtual_tryon_reserve_retry_scheduled");
    expect(await store.findByIdempotency({ userId: "user", key: "reserve-timeout" })).toMatchObject({ job: { status: "draft" } });
    expect(store.listJobs()[0]?.nextRetryAt).toBeInstanceOf(Date);
  });

  it("rejects duplicate asset ids and moderation denials before drafting or reserving", async () => {
    const credits = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: credits, userId: "user", amount: 10, reason: "test", idempotencyKey: "grant" });
    const store = createInMemoryVirtualTryOnStore({ sources: [source("front"), source("back", "back"), source("detail", "detail")] });

    await expect(createVirtualTryOn({ userId: "user", key: "duplicate", mode: "three_view", sourceAssetIds: { front: "front", back: "front", detail: "detail" } }, { store, creditStore: credits, env, moderate: async () => ({ allowed: true, decision: "allow", moderationId: "m", errorCode: null }) })).rejects.toThrow("virtual_tryon_duplicate_source_asset");
    await expect(createVirtualTryOn({ userId: "user", key: "denied", mode: "front_only", sourceAssetIds: { front: "front" } }, { store, creditStore: credits, env, moderate: async () => ({ allowed: false, decision: "deny", moderationId: "m", errorCode: null }) })).rejects.toThrow("virtual_tryon_moderation_blocked");
    expect(store.listJobs()).toHaveLength(0);
    expect(credits.listLedger().map((entry) => entry.type)).toEqual(["trial_grant"]);
  });

  it("rejects redacted or incomplete rights before creating a draft", async () => {
    const credits = createInMemoryCreditLedgerStore();
    const redacted = createInMemoryVirtualTryOnStore({ sources: [source("front", "front", { rightsAttestationRedactedAt: new Date() })] });
    const missingAcceptedAt = createInMemoryVirtualTryOnStore({ sources: [source("front", "front", { rightsAttestationAcceptedAt: undefined as unknown as Date })] });
    const deps = (store: ReturnType<typeof createInMemoryVirtualTryOnStore>) => ({ store, creditStore: credits, env, moderate: async () => ({ allowed: true as const, decision: "allow" as const, moderationId: "m", errorCode: null }) });

    await expect(createVirtualTryOn({ userId: "user", key: "redacted", mode: "front_only", sourceAssetIds: { front: "front" } }, deps(redacted))).rejects.toThrow("virtual_tryon_asset_rights_required");
    await expect(createVirtualTryOn({ userId: "user", key: "missing-attestation", mode: "front_only", sourceAssetIds: { front: "front" } }, deps(missingAcceptedAt))).rejects.toThrow("virtual_tryon_asset_rights_required");
    expect(redacted.listJobs()).toHaveLength(0);
    expect(missingAcceptedAt.listJobs()).toHaveLength(0);
  });

  it("replays a draft with one idempotent reserve and persists its ledger event", async () => {
    const credits = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "grant" });
    const store = createInMemoryVirtualTryOnStore({ sources: [source("front")] });
    await store.createJobAndPack({ userId: "user", mode: "front_only", key: "draft-replay", creditCost: 2, requiredViews: ["front"], sourceSnapshot: { sources: { front: { assetId: "front", key: "assets/front.png" } } }, modelSnapshot: {}, rightsSnapshot: {} });
    const deps = { store, creditStore: credits, env, moderate: async () => ({ allowed: true as const, decision: "allow" as const, moderationId: "m", errorCode: null }) };

    const first = await createVirtualTryOn({ userId: "user", key: "draft-replay", mode: "front_only", sourceAssetIds: { front: "front" } }, deps);
    const replay = await createVirtualTryOn({ userId: "user", key: "draft-replay", mode: "front_only", sourceAssetIds: { front: "front" } }, deps);

    expect(first.job.id).toBe(replay.job.id);
    expect(credits.listLedger().filter((entry) => entry.type === "reserve")).toHaveLength(1);
    expect(store.listStateEvents()).toHaveLength(1);
  });

  it("creates one job for concurrent identical idempotency requests", async () => {
    const credits = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: credits, userId: "user", amount: 10, reason: "test", idempotencyKey: "grant" });
    const store = createInMemoryVirtualTryOnStore({ sources: [source("front")] });
    const deps = { store, creditStore: credits, env, moderate: async () => ({ allowed: true as const, decision: "allow" as const, moderationId: "m", errorCode: null }) };
    const request = { userId: "user", key: "concurrent", mode: "front_only" as const, sourceAssetIds: { front: "front" } };

    const [first, second] = await Promise.all([createVirtualTryOn(request, deps), createVirtualTryOn(request, deps)]);

    expect(first.job.id).toBe(second.job.id);
    expect(store.listJobs()).toHaveLength(1);
    expect(credits.listLedger().filter((entry) => entry.type === "reserve")).toHaveLength(1);
  });

  it("does not reserve again for a failed_unreserved idempotency key", async () => {
    const credits = createInMemoryCreditLedgerStore();
    const store = createInMemoryVirtualTryOnStore({ sources: [source("front")] });
    const deps = { store, creditStore: credits, env, moderate: async () => ({ allowed: true as const, decision: "allow" as const, moderationId: "m", errorCode: null }) };
    const request = { userId: "user", key: "failed-key", mode: "front_only" as const, sourceAssetIds: { front: "front" } };

    await expect(createVirtualTryOn(request, deps)).rejects.toThrow("Insufficient available credits");
    await grantTrialCredits({ store: credits, userId: "user", amount: 2, reason: "late grant", idempotencyKey: "grant" });
    await expect(createVirtualTryOn(request, deps)).rejects.toThrow("virtual_tryon_failed_unreserved");
    expect(credits.listLedger().filter((entry) => entry.type === "reserve")).toHaveLength(0);
  });
});
