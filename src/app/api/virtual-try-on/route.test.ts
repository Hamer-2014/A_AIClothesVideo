import { describe, expect, it } from "vitest";

import { handleCreateVirtualTryOnRequest } from "./route";

const body = { mode: "front_only", skuName: "  Linen dress  ", sourceAssetIds: { front: "asset-front" } };
const session = async () => ({ user: { id: "user-1" } });
const created = { job: { id: "job-1", status: "queued" }, pack: { id: "pack-1" } };

describe("POST /api/virtual-try-on", () => {
  it("requires a session and a trimmed Idempotency-Key", async () => {
    const unauthenticated = await handleCreateVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on", { method: "POST", body: JSON.stringify(body) }), { getSession: async () => null });
    const invalid = await handleCreateVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on", { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": "   " } }), { getSession: session });

    expect(unauthenticated.status).toBe(401);
    expect(invalid.status).toBe(400);
  });

  it("strictly validates input and forwards the header key to creation", async () => {
    const seen: unknown[] = [];
    const response = await handleCreateVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on", { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": "  request-1  " } }), {
      getSession: session,
      createVirtualTryOn: async (input) => { seen.push(input); return created; },
    });
    const invalid = await handleCreateVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on", { method: "POST", body: JSON.stringify({ mode: "three_view", sourceAssetIds: { front: "asset" } }), headers: { "Idempotency-Key": "request-2" } }), { getSession: session });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ jobId: "job-1", status: "queued", packId: "pack-1" });
    expect(seen).toEqual([expect.objectContaining({ userId: "user-1", key: "request-1", mode: "front_only", skuName: "Linen dress", sourceAssetIds: { front: "asset-front" } })]);
    expect(invalid.status).toBe(400);
  });

  it("forwards an explicit smoke isTest marker without marking ordinary owner requests", async () => {
    const seen: unknown[] = [];
    await handleCreateVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on", { method: "POST", body: JSON.stringify({ ...body, isTest: true }), headers: { "Idempotency-Key": "smoke" } }), { getSession: session, createVirtualTryOn: async (input) => { seen.push(input); return created; } });
    await handleCreateVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on", { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": "ordinary" } }), { getSession: session, createVirtualTryOn: async (input) => { seen.push(input); return created; } });
    expect(seen).toEqual([expect.objectContaining({ isTest: true }), expect.not.objectContaining({ isTest: true })]);
  });

  it.each([
    ["virtual_tryon_asset_rights_required", 400],
    ["Insufficient available credits.", 402],
    ["virtual_tryon_failed_unreserved", 402],
    ["virtual_tryon_idempotency_conflict", 409],
    ["virtual_tryon_config_unavailable", 503],
    ["virtual_tryon_moderation_blocked", 503],
    ["virtual_tryon_reserve_retry_scheduled", 503],
    ["database exploded", 500],
  ])("maps %s without leaking internals", async (message, status) => {
    const response = await handleCreateVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on", { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": "request-1" } }), {
      getSession: session,
      createVirtualTryOn: async () => { throw new Error(message); },
    });
    const responseBody = await response.json();

    expect(response.status).toBe(status);
    if (status === 500) expect(JSON.stringify(responseBody)).not.toContain(message);
  });
});
