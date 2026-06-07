import { describe, expect, it } from "vitest";

import { handleFileSignedUrlRequest } from "./route";

describe("GET /api/files/signed-url", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleFileSignedUrlRequest(
      new Request("http://localhost/api/files/signed-url?assetId=asset-1"),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the asset does not belong to the user", async () => {
    const response = await handleFileSignedUrlRequest(
      new Request("http://localhost/api/files/signed-url?assetId=asset-1"),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        findAsset: async () => null,
      },
    );

    expect(response.status).toBe(404);
  });

  it("returns a signed URL for the owner's asset", async () => {
    const response = await handleFileSignedUrlRequest(
      new Request("http://localhost/api/files/signed-url?assetId=asset-1"),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        findAsset: async () => ({
          id: "asset-1",
          originalKey: "users/user-1/assets/asset-1/original.jpg",
        }),
        createDownloadSignedUrl: async ({ key }) =>
          `https://download.example/${key}`,
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      url: "https://download.example/users/user-1/assets/asset-1/original.jpg",
      expiresIn: 900,
    });
  });
});
