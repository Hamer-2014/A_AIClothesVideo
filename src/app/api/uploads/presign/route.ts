import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { buildAssetOriginalKey } from "@/lib/storage/keys";
import { createUploadSignedUrl as createR2UploadSignedUrl } from "@/lib/storage/presign";
import { validateUploadFile } from "@/lib/storage/validation";
import type { AssetRole } from "@/server/assets/analysis-schema";
import {
  createAttestationWithAssets as createRightsAttestationWithAssets,
  parseRightsAttestation,
  type CreateAttestationWithAssetsInput,
  type CreateAttestationWithAssetsResult,
} from "@/server/compliance/rights-attestation";

type UploadSession = {
  user?: {
    id?: string;
  };
} | null;

interface UploadPresignDeps {
  getSession?: () => Promise<UploadSession>;
  createUploadSignedUrl?: (input: {
    key: string;
    contentType: string;
  }) => Promise<{ url: string; headers: Record<string, string> }>;
  createAttestationWithAssets?: (
    input: CreateAttestationWithAssetsInput,
  ) => Promise<CreateAttestationWithAssetsResult>;
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

function getRequestIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

function getRequestLocale(request: Request) {
  const acceptLanguage = request.headers.get("accept-language");
  return acceptLanguage?.split(",")[0]?.split(";")[0]?.trim() || "zh-CN";
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
  let attestation;
  try {
    attestation = parseRightsAttestation(body.rightsAttestation);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "rights_attestation_required") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    if (code === "rights_attestation_version_mismatch") {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    throw error;
  }
  const { files, batch } = parseUploadFiles(body);

  if (files.length === 0 || files.length > 8) {
    return NextResponse.json({ error: "invalid_upload_batch" }, { status: 400 });
  }

  const createAttestationWithAssets =
    deps.createAttestationWithAssets ?? createRightsAttestationWithAssets;
  const createUploadSignedUrl =
    deps.createUploadSignedUrl ??
    ((input) =>
      createR2UploadSignedUrl({
        key: input.key,
        contentType: input.contentType,
      }));
  const validatedFiles: CreateAttestationWithAssetsInput["files"] = [];

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
    validatedFiles.push({
      id: assetId,
      key,
      fileName: file.fileName,
      mimeType: validation.mimeType,
      fileSize: file.fileSize,
      detectedRole: file.intendedRole,
      status: "pending_upload",
    });
  }

  let createdAssets: CreateAttestationWithAssetsResult;
  try {
    createdAssets = await createAttestationWithAssets({
      userId,
      attestation,
      scope: "upload",
      locale: getRequestLocale(request),
      ipAddress: getRequestIpAddress(request),
      userAgent: request.headers.get("user-agent"),
      files: validatedFiles,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "compliance_hash_secret_required") {
      return NextResponse.json({ error: code }, { status: 503 });
    }
    if (code === "invalid_upload_batch") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    throw error;
  }

  const filesById = new Map(validatedFiles.map((file) => [file.id, file]));
  const signedFiles = await Promise.all(
    createdAssets.assets.map(async (asset) => {
      const file = filesById.get(asset.id);
      if (!file) {
        throw new Error("rights_attestation_asset_mismatch");
      }
      const signed = await createUploadSignedUrl({
        key: asset.key,
        contentType: file.mimeType,
      });

      return {
        assetId: asset.id,
        fileName: file.fileName,
        intendedRole: file.detectedRole,
        uploadUrl: signed.url,
        headers: signed.headers,
      };
    }),
  );

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
