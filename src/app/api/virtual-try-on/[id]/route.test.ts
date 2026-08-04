import { describe, expect, it } from "vitest";

import type { OwnedVirtualTryOnDetail } from "@/server/virtual-tryon/owner";
import { handleGetVirtualTryOnRequest } from "./route";

const detail: OwnedVirtualTryOnDetail = { job: { id: "job-1", mode: "front_only", status: "ready", queueHealth: "normal" }, pack: { id: "pack-1", version: 1, status: "ready", lockedAt: null }, views: [{ id: "asset-1", view: "front", status: "succeeded" }], bridge: { kind: "virtual_tryon_appearance_pack", appearancePackId: "pack-1", version: 1, mode: "front_only", provenance: "generated_apimart_gpt_image_2", videoGeneration: "requires_lock" } };

describe("GET /api/virtual-try-on/[id]", () => {
  it("returns 401 for no session and 404 for an unknown or other owner job", async () => {
    const unauthenticated = await handleGetVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on/job-1"), { params: { id: "job-1" } }, { getSession: async () => null });
    const hidden = await handleGetVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on/job-1"), { params: { id: "job-1" } }, { getSession: async () => ({ user: { id: "other" } }), getDetail: async () => null });

    expect(unauthenticated.status).toBe(401);
    expect(hidden.status).toBe(404);
  });

  it("maps the bridge field and never serializes storage or provider fields", async () => {
    const response = await handleGetVirtualTryOnRequest(new Request("http://localhost/api/virtual-try-on/job-1"), { params: { id: "job-1" } }, { getSession: async () => ({ user: { id: "owner" } }), getDetail: async () => detail });
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toMatchObject({ job: detail.job, pack: detail.pack, views: detail.views, videoBridge: detail.bridge });
    expect(JSON.stringify(responseBody)).not.toMatch(/r2Key|providerTaskId|https?:\/\//);
  });
});
