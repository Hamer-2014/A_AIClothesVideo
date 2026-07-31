import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { assets, videoJobAssets, videoJobs } from "@/lib/db/schema";
import { createDownloadSignedUrl as createR2DownloadSignedUrl } from "@/lib/storage/presign";

export interface JobSourceAssetRecord {
  assetId: string;
  role: string;
  sortOrder: number;
  originalKey: string;
  fileName: string;
  mimeType: string;
}

export interface JobSourceAssetStore {
  listOwnedJobAssets(input: {
    jobId: string;
    userId: string;
  }): Promise<JobSourceAssetRecord[]>;
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleJobSourceAssetStore(
  db: DbClient = getDb(),
): JobSourceAssetStore {
  return {
    listOwnedJobAssets({ jobId, userId }) {
      return db
        .select({
          assetId: assets.id,
          role: videoJobAssets.role,
          sortOrder: videoJobAssets.sortOrder,
          originalKey: assets.originalKey,
          fileName: assets.fileName,
          mimeType: assets.mimeType,
        })
        .from(videoJobAssets)
        .innerJoin(videoJobs, eq(videoJobs.id, videoJobAssets.videoJobId))
        .innerJoin(assets, eq(assets.id, videoJobAssets.assetId))
        .where(
          and(
            eq(videoJobs.id, jobId),
            eq(videoJobs.userId, userId),
            eq(assets.userId, userId),
            isNull(videoJobs.deletedAt),
            isNull(assets.deletedAt),
          ),
        )
        .orderBy(asc(videoJobAssets.sortOrder));
    },
  };
}

export async function getJobSourceAssets({
  jobId,
  userId,
  store = createDrizzleJobSourceAssetStore(),
  createDownloadSignedUrl = ({ key }) =>
    createR2DownloadSignedUrl({ key, expiresIn: 900 }),
}: {
  jobId: string;
  userId: string;
  store?: JobSourceAssetStore;
  createDownloadSignedUrl?: (input: { key: string }) => Promise<string>;
}) {
  const records = await store.listOwnedJobAssets({ jobId, userId });

  return Promise.all(
    records.map(async ({ originalKey, ...asset }) => {
      try {
        return {
          ...asset,
          previewUrl: await createDownloadSignedUrl({ key: originalKey }),
        };
      } catch {
        return {
          ...asset,
          previewUrl: null,
        };
      }
    }),
  );
}
