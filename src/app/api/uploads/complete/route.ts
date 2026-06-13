import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getServerSession } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";

type UploadCompleteSession = {
  user?: {
    id?: string;
  };
} | null;

interface UploadCompleteDeps {
  getSession?: () => Promise<UploadCompleteSession>;
  completeAsset?: (input: {
    assetId: string;
    userId: string;
  }) => Promise<boolean>;
}

function parseAssetId(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  return typeof record.assetId === "string" ? record.assetId.trim() : "";
}

async function completeAssetUpload({
  assetId,
  userId,
}: {
  assetId: string;
  userId: string;
}) {
  const [record] = await getDb()
    .update(assets)
    .set({ status: "uploaded" })
    .where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
    .returning({ id: assets.id });

  return Boolean(record);
}

export async function handleUploadCompleteRequest(
  request: Request,
  deps: UploadCompleteDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const assetId = parseAssetId(await request.json().catch(() => ({})));
  if (!assetId) {
    return NextResponse.json({ error: "invalid_asset_id" }, { status: 400 });
  }

  const completed = await (deps.completeAsset ?? completeAssetUpload)({
    assetId,
    userId,
  });

  if (!completed) {
    return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
  }

  return NextResponse.json({ assetId, status: "uploaded" });
}

export async function POST(request: Request) {
  return handleUploadCompleteRequest(request);
}
