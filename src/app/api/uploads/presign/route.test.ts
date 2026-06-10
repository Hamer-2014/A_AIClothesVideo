import { describe, expect, it } from "vitest";

import { handleUploadPresignRequest } from "./route";

describe("POST /api/uploads/presign", () => {
  it("returns 401 when the user is not authenticated", async () => {
    const response = await handleUploadPresignRequest(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          fileName: "dress.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
        }),
      }),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("creates an asset record and returns a signed upload URL", async () => {
    const createdAssets: unknown[] = [];
    const response = await handleUploadPresignRequest(
      new Request("http://localhost/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          fileName: "dress.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createAsset: async (asset) => {
          createdAssets.push(asset);
          return {
            id: "asset-1",
            key: "users/user-1/assets/asset-1/original.jpg",
          };
        },
        createUploadSignedUrl: async ({ key }) => ({
          url: `https://upload.example/${key}`,
          headers: { "content-type": "image/jpeg" },
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createdAssets).toHaveLength(1);
    expect(body).toMatchObject({
      assetId: "asset-1",
      uploadUrl: "https://upload.example/users/user-1/assets/asset-1/original.jpg",
      headers: { "content-type": "image/jpeg" },
    });
    expect(body).not.toHaveProperty("key");
  });
});
