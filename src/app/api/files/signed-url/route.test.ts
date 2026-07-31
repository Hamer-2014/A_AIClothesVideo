import { afterEach, describe, expect, it, vi } from "vitest";

import { handleFileSignedUrlRequest } from "./route";

describe("GET /api/files/signed-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("returns the configured asset URL for the owner", async () => {
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
      expiresIn: null,
    });
  });

  it("returns the public custom-domain URL by default", async () => {
    vi.stubEnv("CLOUDFLARE_R2_PUBLIC_BASE_URL", "https://media.example.com");
    const response = await handleFileSignedUrlRequest(
      new Request("http://localhost/api/files/signed-url?assetId=asset-1"),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        findAsset: async () => ({
          id: "asset-1",
          originalKey: "users/user-1/assets/asset-1/original.jpg",
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      url: "https://media.example.com/users/user-1/assets/asset-1/original.jpg",
      expiresIn: null,
    });
  });
});
