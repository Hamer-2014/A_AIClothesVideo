import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { createDrizzleVirtualTryOnOwnerStore, createVirtualTryOnDownload, createVirtualTryOnPreview, type VirtualTryOnOwnerStore } from "@/server/virtual-tryon/owner";

type Session = { user?: { id?: string } } | null;
interface DownloadVirtualTryOnRouteDeps {
  getSession?: () => Promise<Session>;
  createDownload?: (input: { userId: string; jobId: string; assetId: string }) => Promise<string>;
  createPreview?: (input: { userId: string; jobId: string; assetId: string }) => Promise<string>;
  store?: VirtualTryOnOwnerStore;
}

export async function handleVirtualTryOnDownloadRequest(request: Request, context: { params: { id: string; assetId: string } }, deps: DownloadVirtualTryOnRouteDeps = {}) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = deps.store ?? createDrizzleVirtualTryOnOwnerStore();
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const createSignature = preview
    ? deps.createPreview ?? ((input: { userId: string; jobId: string; assetId: string }) => createVirtualTryOnPreview(input, store))
    : deps.createDownload ?? ((input: { userId: string; jobId: string; assetId: string }) => createVirtualTryOnDownload(input, store));
  try {
    const url = await createSignature({ userId, jobId: context.params.id, assetId: context.params.assetId });
    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    if (error instanceof Error && error.message === "appearance_pack_asset_not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "virtual_tryon_download_failed" }, { status: 500 });
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  return handleVirtualTryOnDownloadRequest(request, { params: await context.params });
}
