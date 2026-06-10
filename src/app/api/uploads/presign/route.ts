import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { buildAssetOriginalKey } from "@/lib/storage/keys";
import { createUploadSignedUrl as createR2UploadSignedUrl } from "@/lib/storage/presign";
import { validateUploadFile } from "@/lib/storage/validation";

type UploadSession = {
  user?: {
    id?: string;
  };
} | null;

interface UploadPresignDeps {
  getSession?: () => Promise<UploadSession>;
  createAsset?: (asset: {
    id: string;
    userId: string;
    key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }) => Promise<{ id: string; key: string }>;
  createUploadSignedUrl?: (input: {
    key: string;
    contentType: string;
  }) => Promise<{ url: string; headers: Record<string, string> }>;
}

async function createAssetRecord(asset: {
  id: string;
  userId: string;
  key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}) {
  await getDb().insert(assets).values({
    id: asset.id,
    userId: asset.userId,
    originalKey: asset.key,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
  });

  return {
    id: asset.id,
    key: asset.key,
  };
}

export async function handleUploadPresignRequest(
  request: Request,
  deps: UploadPresignDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validation = validateUploadFile({
    fileName: body.fileName,
    mimeType: body.mimeType,
    fileSize: body.fileSize,
  });

  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason },
      { status: 400 },
    );
  }

  const assetId = randomUUID();
  const key = buildAssetOriginalKey(userId, assetId, validation.mimeType);
  const createAsset = deps.createAsset ?? createAssetRecord;
  const createUploadSignedUrl =
    deps.createUploadSignedUrl ??
    ((input) =>
      createR2UploadSignedUrl({
        key: input.key,
        contentType: input.contentType,
      }));
  const asset = await createAsset({
    id: assetId,
    userId,
    key,
    fileName: body.fileName,
    mimeType: validation.mimeType,
    fileSize: body.fileSize,
  });
  const signed = await createUploadSignedUrl({
    key: asset.key,
    contentType: validation.mimeType,
  });

  return NextResponse.json({
    assetId: asset.id,
    uploadUrl: signed.url,
    headers: signed.headers,
  });
}

export async function POST(request: Request) {
  return handleUploadPresignRequest(request);
}
