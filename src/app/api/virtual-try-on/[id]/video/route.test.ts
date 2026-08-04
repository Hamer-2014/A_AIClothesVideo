import { describe, expect, it, vi } from "vitest";

import { handleCreateVirtualTryOnVideoRequest } from "./route";

const validBody = {
  packId: "pack-2",
  idempotencyKey: "bridge-request-1",
  durationSeconds: 24,
  aspectRatio: "9:16",
  presetId: "minimal_studio",
};

function request(body: unknown = validBody) {
  return new Request("http://localhost/api/virtual-try-on/tryon-job-1/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/virtual-try-on/[id]/video", () => {
  it("requires an authenticated owner session", async () => {
    const createBridge = vi.fn();
    const response = await handleCreateVirtualTryOnVideoRequest(request(), { params: { id: "tryon-job-1" } }, { getSession: async () => null, createBridge });
    expect(response.status).toBe(401);
    expect(createBridge).not.toHaveBeenCalled();
  });

  it("creates a paid video bridge and returns 201", async () => {
    const createBridge = vi.fn().mockResolvedValue({ videoJobId: "video-job-1", status: "asset_analysis_queued", replayed: false });
    const response = await handleCreateVirtualTryOnVideoRequest(request(), { params: { id: "tryon-job-1" } }, { getSession: async () => ({ user: { id: "owner" } }), createBridge });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ videoJobId: "video-job-1", status: "asset_analysis_queued", replayed: false });
    expect(createBridge).toHaveBeenCalledWith({ userId: "owner", jobId: "tryon-job-1", ...validBody });
  });

  it("returns 200 for an idempotent replay", async () => {
    const response = await handleCreateVirtualTryOnVideoRequest(request(), { params: { id: "tryon-job-1" } }, {
      getSession: async () => ({ user: { id: "owner" } }),
      createBridge: async () => ({ videoJobId: "video-job-1", status: "storyboard_draft_ready", replayed: true }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ videoJobId: "video-job-1", replayed: true });
  });

  it.each([
    [{ ...validBody, durationSeconds: 40 }],
    [{ ...validBody, aspectRatio: "4:3" }],
    [{ ...validBody, presetId: "unknown" }],
    [{ ...validBody, idempotencyKey: "short" }],
    [{ ...validBody, packId: null }],
  ])("rejects invalid input without calling the service", async (body) => {
    const createBridge = vi.fn();
    const response = await handleCreateVirtualTryOnVideoRequest(request(body), { params: { id: "tryon-job-1" } }, { getSession: async () => ({ user: { id: "owner" } }), createBridge });
    expect(response.status).toBe(400);
    expect(createBridge).not.toHaveBeenCalled();
  });

  it.each([
    ["appearance_pack_not_found", 404, "not_found"],
    ["appearance_pack_not_latest", 409, "appearance_pack_not_latest"],
    ["appearance_pack_not_locked", 409, "appearance_pack_not_locked"],
    ["appearance_pack_strict_qa_required", 409, "appearance_pack_strict_qa_required"],
    ["appearance_pack_source_rights_revoked", 409, "appearance_pack_source_rights_revoked"],
    ["video_bridge_idempotency_mismatch", 409, "video_bridge_idempotency_mismatch"],
    ["video_bridge_in_progress", 409, "video_bridge_in_progress"],
  ])("maps %s to a safe API error", async (message, status, publicError) => {
    const response = await handleCreateVirtualTryOnVideoRequest(request(), { params: { id: "tryon-job-1" } }, {
      getSession: async () => ({ user: { id: "owner" } }),
      createBridge: async () => { throw new Error(message); },
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: publicError });
  });

  it.each([
    "postgres at private-host:5432 failed",
    "appearance_pack_materialized_asset_invalid",
  ])("does not leak internal failure %s", async (message) => {
    const response = await handleCreateVirtualTryOnVideoRequest(request(), { params: { id: "tryon-job-1" } }, {
      getSession: async () => ({ user: { id: "owner" } }),
      createBridge: async () => { throw new Error(message); },
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "video_bridge_failed" });
  });
});
