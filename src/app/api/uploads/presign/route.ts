import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { buildAssetOriginalKey } from "@/lib/storage/keys";
import { createUploadSignedUrl as createR2UploadSignedUrl } from "@/lib/storage/presign";
import { validateUploadFile } from "@/lib/storage/validation";
import type { AssetRole } from "@/server/assets/analysis-schema";

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
    detectedRole: AssetRole;
    status: "pending_upload" | "uploaded";
  }) => Promise<{ id: string; key: string }>;
  createUploadSignedUrl?: (input: {
    key: string;
    contentType: string;
  }) => Promise<{ url: string; headers: Record<string, string> }>;
}

const uploadSlotRoles: AssetRole[] = [
  "front",
  "back",
  "side",
  "detail",
  "scene",
  "logo",
  "unknown",
];

interface UploadFileRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
  intendedRole: AssetRole;
}

function parseIntendedRole(value: unknown): AssetRole {
  return typeof value === "string" && uploadSlotRoles.includes(value as AssetRole)
    ? (value as AssetRole)
    : "unknown";
}

function parseUploadFiles(body: Record<string, unknown>): {
  files: UploadFileRequest[];
  batch: boolean;
} {
  if (Array.isArray(body.files)) {
    return {
      batch: true,
      files: body.files
        .filter((file): file is Record<string, unknown> =>
          Boolean(file) && typeof file === "object" && !Array.isArray(file),
        )
        .map((file) => ({
          fileName: typeof file.fileName === "string" ? file.fileName : "",
          mimeType: typeof file.mimeType === "string" ? file.mimeType : "",
          fileSize: typeof file.fileSize === "number" ? file.fileSize : Number.NaN,
          intendedRole: parseIntendedRole(file.intendedRole),
        })),
    };
  }

  return {
    batch: false,
    files: [
      {
        fileName: typeof body.fileName === "string" ? body.fileName : "",
        mimeType: typeof body.mimeType === "string" ? body.mimeType : "",
        fileSize: typeof body.fileSize === "number" ? body.fileSize : Number.NaN,
        intendedRole: parseIntendedRole(body.intendedRole),
      },
    ],
  };
}

async function createAssetRecord(asset: {
  id: string;
  userId: string;
  key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  detectedRole: AssetRole;
  status: "pending_upload" | "uploaded";
}) {
  await getDb().insert(assets).values({
    id: asset.id,
    userId: asset.userId,
    status: asset.status,
    originalKey: asset.key,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    detectedRole: asset.detectedRole,
    metadata: {
      intendedRole: asset.detectedRole,
      uploadState: asset.status,
    },
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

  const body = (await request.json()) as Record<string, unknown>;
  const { files, batch } = parseUploadFiles(body);

  if (files.length === 0 || files.length > 8) {
    return NextResponse.json({ error: "invalid_upload_batch" }, { status: 400 });
  }

  const createAsset = deps.createAsset ?? createAssetRecord;
  const createUploadSignedUrl =
    deps.createUploadSignedUrl ??
    ((input) =>
      createR2UploadSignedUrl({
        key: input.key,
        contentType: input.contentType,
      }));
  const signedFiles = [];

  for (const file of files) {
    const validation = validateUploadFile({
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.reason, fileName: file.fileName },
        { status: 400 },
      );
    }

    const assetId = randomUUID();
    const key = buildAssetOriginalKey(userId, assetId, validation.mimeType);
    const asset = await createAsset({
      id: assetId,
      userId,
      key,
      fileName: file.fileName,
      mimeType: validation.mimeType,
      fileSize: file.fileSize,
      detectedRole: file.intendedRole,
      status: batch ? "pending_upload" : "uploaded",
    });
    const signed = await createUploadSignedUrl({
      key: asset.key,
      contentType: validation.mimeType,
    });

    signedFiles.push({
      assetId: asset.id,
      fileName: file.fileName,
      intendedRole: file.intendedRole,
      uploadUrl: signed.url,
      headers: signed.headers,
    });
  }

  if (batch) {
    return NextResponse.json({ files: signedFiles });
  }

  const [signed] = signedFiles;
  if (!signed) {
    return NextResponse.json({ error: "invalid_upload_batch" }, { status: 400 });
  }

  return NextResponse.json({
    assetId: signed.assetId,
    uploadUrl: signed.uploadUrl,
    headers: signed.headers,
  });
}

export async function POST(request: Request) {
  return handleUploadPresignRequest(request);
}
