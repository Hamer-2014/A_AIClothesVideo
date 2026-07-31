import { drizzle } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";

import {
  createDrizzleJobSourceAssetStore,
  getJobSourceAssets,
} from "./job-source-assets";

describe("job source assets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires both the job and each linked asset to belong to the user", async () => {
    const queries: string[] = [];
    const db = drizzle.mock({
      schema,
      logger: {
        logQuery(query) {
          queries.push(query);
        },
      },
    });
    const store = createDrizzleJobSourceAssetStore(
      db as unknown as NonNullable<
        Parameters<typeof createDrizzleJobSourceAssetStore>[0]
      >,
    );

    await expect(
      store.listOwnedJobAssets({ jobId: "job-1", userId: "user-1" }),
    ).rejects.toThrow("Failed query");

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('"video_jobs"."user_id" =');
    expect(queries[0]).toContain('"assets"."user_id" =');
  });

  it("uses the required public custom domain when reopening source assets", async () => {
    vi.stubEnv("CLOUDFLARE_R2_PUBLIC_BASE_URL", "https://media.example.com/assets");
    const result = await getJobSourceAssets({
      jobId: "job-1",
      userId: "user-1",
      store: {
        listOwnedJobAssets: async () => [
          {
            assetId: "asset-front",
            role: "front",
            sortOrder: 0,
            originalKey: "users/user-1/assets/asset-front/original.webp",
            fileName: "front.webp",
            mimeType: "image/webp",
          },
          {
            assetId: "asset-back",
            role: "back",
            sortOrder: 1,
            originalKey: "users/user-1/assets/asset-back/original.webp",
            fileName: "back.webp",
            mimeType: "image/webp",
          },
        ],
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        assetId: "asset-front",
        previewUrl:
          "https://media.example.com/assets/users/user-1/assets/asset-front/original.webp",
      }),
      expect.objectContaining({
        assetId: "asset-back",
        previewUrl:
          "https://media.example.com/assets/users/user-1/assets/asset-back/original.webp",
      }),
    ]);
  });

  it("keeps the task readable when one public asset URL cannot be created", async () => {
    const result = await getJobSourceAssets({
      jobId: "job-1",
      userId: "user-1",
      store: {
        listOwnedJobAssets: async () => [
          {
            assetId: "asset-front",
            role: "front",
            sortOrder: 0,
            originalKey: "users/user-1/assets/asset-front/original.webp",
            fileName: "front.webp",
            mimeType: "image/webp",
          },
          {
            assetId: "asset-back",
            role: "back",
            sortOrder: 1,
            originalKey: "users/user-1/assets/asset-back/original.webp",
            fileName: "back.webp",
            mimeType: "image/webp",
          },
        ],
      },
      createDownloadSignedUrl: async ({ key }) => {
        if (key.includes("asset-back")) {
          throw new Error("invalid public object key");
        }
        return `https://media.example.com/${key}`;
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        assetId: "asset-front",
        previewUrl:
          "https://media.example.com/users/user-1/assets/asset-front/original.webp",
      }),
      expect.objectContaining({
        assetId: "asset-back",
        previewUrl: null,
      }),
    ]);
  });
});
