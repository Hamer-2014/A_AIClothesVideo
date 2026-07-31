import { describe, expect, it } from "vitest";

import { handleVirtualTryOnDownloadRequest } from "./route";

describe("GET /api/virtual-try-on/[id]/assets/[assetId]/download", () => {
  it("requires a session and returns 404 without Location for unavailable assets", async () => {
    const unauthenticated = await handleVirtualTryOnDownloadRequest(new Request("http://localhost/api/virtual-try-on/job-1/assets/asset-1/download"), { params: { id: "job-1", assetId: "asset-1" } }, { getSession: async () => null });
    const missing = await handleVirtualTryOnDownloadRequest(new Request("http://localhost/api/virtual-try-on/job-1/assets/asset-1/download"), { params: { id: "job-1", assetId: "asset-1" } }, { getSession: async () => ({ user: { id: "other" } }), createDownload: async () => { throw new Error("appearance_pack_asset_not_found"); } });
    expect(unauthenticated.status).toBe(401);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("location")).toBeNull();
  });

  it("uses a fixed 302 redirect only after a successful owner download signature", async () => {
    const success = await handleVirtualTryOnDownloadRequest(new Request("http://localhost/api/virtual-try-on/job-1/assets/asset-1/download"), { params: { id: "job-1", assetId: "asset-1" } }, { getSession: async () => ({ user: { id: "owner" } }), createDownload: async () => "https://r2.example/signed?secret=private" });
    const failure = await handleVirtualTryOnDownloadRequest(new Request("http://localhost/api/virtual-try-on/job-1/assets/asset-1/download"), { params: { id: "job-1", assetId: "asset-1" } }, { getSession: async () => ({ user: { id: "owner" } }), createDownload: async () => { throw new Error("r2_down"); } });
    expect(success.status).toBe(302);
    expect(success.headers.get("location")).toBe("https://r2.example/signed?secret=private");
    expect(failure.status).toBe(500);
    expect(failure.headers.get("location")).toBeNull();
    expect(JSON.stringify(await failure.json())).not.toContain("r2_down");
  });

  it("keeps preview signatures behind the same owner gate without attachment naming", async () => {
    const createPreview = async () => "https://r2.example/preview?secret=private";
    const success = await handleVirtualTryOnDownloadRequest(new Request("http://localhost/api/virtual-try-on/job-1/assets/asset-1/download?preview=1"), { params: { id: "job-1", assetId: "asset-1" } }, { getSession: async () => ({ user: { id: "owner" } }), createPreview });
    const missing = await handleVirtualTryOnDownloadRequest(new Request("http://localhost/api/virtual-try-on/job-1/assets/asset-1/download?preview=1"), { params: { id: "job-1", assetId: "asset-1" } }, { getSession: async () => ({ user: { id: "other" } }), createPreview: async () => { throw new Error("appearance_pack_asset_not_found"); } });
    expect(success.status).toBe(302);
    expect(success.headers.get("location")).toContain("preview");
    expect(missing.status).toBe(404);
  });
});
