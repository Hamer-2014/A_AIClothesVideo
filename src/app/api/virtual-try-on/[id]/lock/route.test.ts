import { describe, expect, it } from "vitest";

import type { OwnedVirtualTryOnDetail } from "@/server/virtual-tryon/owner";
import { handleLockVirtualTryOnRequest } from "./route";

const detail: OwnedVirtualTryOnDetail = { job: { id: "job-1", mode: "front_only", status: "ready" }, pack: { id: "pack-1", version: 1, status: "ready", lockedAt: null }, views: [], bridge: null };

describe("POST /api/virtual-try-on/[id]/lock", () => {
  it("requires a session and hides a missing owner detail", async () => {
    const unauthenticated = await handleLockVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on/job-1/lock", { method: "POST", body: JSON.stringify({ packId: "pack-1" }) }), { params: { id: "job-1" } }, { getSession: async () => null });
    const hidden = await handleLockVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on/job-1/lock", { method: "POST", body: JSON.stringify({ packId: "pack-1" }) }), { params: { id: "job-1" } }, { getSession: async () => ({ user: { id: "other" } }), getDetail: async () => null });
    expect(unauthenticated.status).toBe(401);
    expect(hidden.status).toBe(404);
  });

  it("returns 409 for invalid or non-lockable packs and exposes only lock state on success", async () => {
    const invalid = await handleLockVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on/job-1/lock", { method: "POST", body: JSON.stringify({}) }), { params: { id: "job-1" } }, { getSession: async () => ({ user: { id: "owner" } }), getDetail: async () => detail });
    const conflict = await handleLockVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on/job-1/lock", { method: "POST", body: JSON.stringify({ packId: "old-pack" }) }), { params: { id: "job-1" } }, { getSession: async () => ({ user: { id: "owner" } }), getDetail: async () => detail, lockPack: async () => { throw new Error("appearance_pack_not_lockable"); } });
    const lockedAt = new Date("2026-08-01T00:00:00Z");
    const success = await handleLockVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on/job-1/lock", { method: "POST", body: JSON.stringify({ packId: "pack-1" }) }), { params: { id: "job-1" } }, { getSession: async () => ({ user: { id: "owner" } }), getDetail: async () => detail, lockPack: async () => ({ ...detail, pack: { ...detail.pack, status: "locked", lockedAt } }) });

    expect(invalid.status).toBe(400);
    expect(conflict.status).toBe(409);
    expect(await success.json()).toEqual({ packId: "pack-1", status: "locked", lockedAt: lockedAt.toISOString() });
  });
});
