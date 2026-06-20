import { describe, expect, it, vi } from "vitest";

import { handleUploadCompleteRequest } from "./route";

describe("POST /api/uploads/complete", () => {
  it("returns 401 when the user is not authenticated", async () => {
    const completeAsset = vi.fn();

    const response = await handleUploadCompleteRequest(
      new Request("http://localhost/api/uploads/complete", {
        method: "POST",
        body: JSON.stringify({ assetId: "asset-1" }),
      }),
      {
        getSession: async () => null,
        completeAsset,
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(completeAsset).not.toHaveBeenCalled();
  });

  it("marks an authenticated user's asset as uploaded", async () => {
    const completeAsset = vi.fn().mockResolvedValue(true);

    const response = await handleUploadCompleteRequest(
      new Request("http://localhost/api/uploads/complete", {
        method: "POST",
        body: JSON.stringify({ assetId: "asset-1" }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        completeAsset,
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      assetId: "asset-1",
      status: "uploaded",
    });
    expect(completeAsset).toHaveBeenCalledWith({
      assetId: "asset-1",
      userId: "user-1",
    });
  });
});
