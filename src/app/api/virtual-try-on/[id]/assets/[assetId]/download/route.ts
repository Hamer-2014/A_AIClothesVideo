import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { createDrizzleVirtualTryOnOwnerStore, createVirtualTryOnDownload, type VirtualTryOnOwnerStore } from "@/server/virtual-tryon/owner";

type Session = { user?: { id?: string } } | null;
interface DownloadVirtualTryOnRouteDeps {
  getSession?: () => Promise<Session>;
  createDownload?: (input: { userId: string; jobId: string; assetId: string }) => Promise<string>;
  store?: VirtualTryOnOwnerStore;
}

export async function handleVirtualTryOnDownloadRequest(_request: Request, context: { params: { id: string; assetId: string } }, deps: DownloadVirtualTryOnRouteDeps = {}) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const createDownload = deps.createDownload ?? ((input: { userId: string; jobId: string; assetId: string }) => createVirtualTryOnDownload(input, deps.store ?? createDrizzleVirtualTryOnOwnerStore()));
  try {
    const url = await createDownload({ userId, jobId: context.params.id, assetId: context.params.assetId });
    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    if (error instanceof Error && error.message === "appearance_pack_asset_not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "virtual_tryon_download_failed" }, { status: 500 });
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  return handleVirtualTryOnDownloadRequest(request, { params: await context.params });
}
