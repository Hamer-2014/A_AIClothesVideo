import { describe, expect, it, vi } from "vitest";

import { handleAttestAssetRightsRequest } from "./route";

describe("POST /api/assets/attest-rights", () => {
  it("attests only assets owned by the signed-in user", async () => {
    const attestAssets = vi.fn().mockRejectedValue(
      new Error("rights_attestation_asset_not_found"),
    );
    const response = await handleAttestAssetRightsRequest(
      new Request("http://localhost/api/assets/attest-rights", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-other-user"],
          rightsAttestation: { accepted: true, version: "image_rights_v1" },
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        attestAssets,
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "rights_attestation_asset_not_found",
    });
  });

  it("requires authentication", async () => {
    const attestAssets = vi.fn();
    const response = await handleAttestAssetRightsRequest(
      new Request("http://localhost/api/assets/attest-rights", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { getSession: async () => null, attestAssets },
    );

    expect(response.status).toBe(401);
    expect(attestAssets).not.toHaveBeenCalled();
  });
});
