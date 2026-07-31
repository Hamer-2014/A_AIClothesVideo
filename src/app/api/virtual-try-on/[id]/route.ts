import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { createDrizzleVirtualTryOnOwnerStore, getVirtualTryOnDetail, type OwnedVirtualTryOnDetail, type VirtualTryOnOwnerStore } from "@/server/virtual-tryon/owner";

type Session = { user?: { id?: string } } | null;
interface GetVirtualTryOnRouteDeps {
  getSession?: () => Promise<Session>;
  getDetail?: (input: { userId: string; jobId: string }) => Promise<OwnedVirtualTryOnDetail | null>;
  store?: VirtualTryOnOwnerStore;
}

export async function handleGetVirtualTryOnRequest(_request: Request, context: { params: { id: string } }, deps: GetVirtualTryOnRouteDeps = {}) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const getDetail = deps.getDetail ?? ((input: { userId: string; jobId: string }) => getVirtualTryOnDetail(input, deps.store ?? createDrizzleVirtualTryOnOwnerStore()));
  const detail = await getDetail({ userId, jobId: context.params.id });
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ job: detail.job, pack: detail.pack, views: detail.views, videoBridge: detail.bridge });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleGetVirtualTryOnRequest(request, { params: await context.params });
}
