import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { createR2PublicUrl } from "@/lib/storage/public-url";

type FileSession = {
  user?: {
    id?: string;
  };
} | null;

interface FileSignedUrlDeps {
  getSession?: () => Promise<FileSession>;
  findAsset?: (input: {
    assetId: string;
    userId: string;
  }) => Promise<{ id: string; originalKey: string } | null>;
  createDownloadSignedUrl?: (input: { key: string }) => Promise<string>;
}

async function findOwnedAsset({
  assetId,
  userId,
}: {
  assetId: string;
  userId: string;
}) {
  const [asset] = await getDb()
    .select({
      id: assets.id,
      originalKey: assets.originalKey,
    })
    .from(assets)
    .where(
      and(
        eq(assets.id, assetId),
        eq(assets.userId, userId),
        isNull(assets.deletedAt),
      ),
    )
    .limit(1);

  return asset ?? null;
}

export async function handleFileSignedUrlRequest(
  request: Request,
  deps: FileSignedUrlDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const assetId = new URL(request.url).searchParams.get("assetId");

  if (!assetId) {
    return NextResponse.json({ error: "asset_id_required" }, { status: 400 });
  }

  const findAsset = deps.findAsset ?? findOwnedAsset;
  const asset = await findAsset({ assetId, userId });

  if (!asset) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const createDownloadSignedUrl =
    deps.createDownloadSignedUrl ??
    (async (input) => createR2PublicUrl({ key: input.key }));
  const url = await createDownloadSignedUrl({ key: asset.originalKey });

  return NextResponse.json({
    url,
    expiresIn: null,
  });
}

export async function GET(request: Request) {
  return handleFileSignedUrlRequest(request);
}
