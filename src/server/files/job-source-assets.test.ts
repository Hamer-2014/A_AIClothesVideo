import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";

import {
  createDrizzleJobSourceAssetStore,
  getJobSourceAssets,
} from "./job-source-assets";

describe("job source assets", () => {
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

  it("keeps the task readable when one asset cannot be signed", async () => {
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
          throw new Error("temporary signing failure");
        }
        return `https://signed-r2.example/${key}`;
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        assetId: "asset-front",
        previewUrl:
          "https://signed-r2.example/users/user-1/assets/asset-front/original.webp",
      }),
      expect.objectContaining({
        assetId: "asset-back",
        previewUrl: null,
      }),
    ]);
  });
});
