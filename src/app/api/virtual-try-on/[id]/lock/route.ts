import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { createDrizzleVirtualTryOnOwnerStore, getVirtualTryOnDetail, lockVirtualTryOnPack, type OwnedVirtualTryOnDetail, type VirtualTryOnOwnerStore } from "@/server/virtual-tryon/owner";

type Session = { user?: { id?: string } } | null;
interface LockVirtualTryOnRouteDeps {
  getSession?: () => Promise<Session>;
  getDetail?: (input: { userId: string; jobId: string }) => Promise<OwnedVirtualTryOnDetail | null>;
  lockPack?: (input: { userId: string; jobId: string; packId: string }) => Promise<OwnedVirtualTryOnDetail>;
  store?: VirtualTryOnOwnerStore;
}

function packIdFrom(body: unknown) {
  return body && typeof body === "object" && !Array.isArray(body) && typeof (body as { packId?: unknown }).packId === "string" && (body as { packId: string }).packId.trim().length > 0 && (body as { packId: string }).packId.trim().length <= 128
    ? (body as { packId: string }).packId.trim()
    : null;
}

export async function handleLockVirtualTryOnRequest(request: Request, context: { params: { id: string } }, deps: LockVirtualTryOnRouteDeps = {}) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const store = deps.store ?? createDrizzleVirtualTryOnOwnerStore();
  const getDetail = deps.getDetail ?? ((input: { userId: string; jobId: string }) => getVirtualTryOnDetail(input, store));
  if (!await getDetail({ userId, jobId: context.params.id })) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const packId = packIdFrom(await request.json().catch(() => null));
  if (!packId) return NextResponse.json({ error: "invalid_virtual_tryon_input" }, { status: 400 });
  const lockPack = deps.lockPack ?? ((input: { userId: string; jobId: string; packId: string }) => lockVirtualTryOnPack(input, store));
  try {
    const detail = await lockPack({ userId, jobId: context.params.id, packId });
    return NextResponse.json({ packId: detail.pack.id, status: detail.pack.status, lockedAt: detail.pack.lockedAt?.toISOString() ?? null });
  } catch (error) {
    if (error instanceof Error && error.message === "appearance_pack_not_lockable") return NextResponse.json({ error: "appearance_pack_not_lockable" }, { status: 409 });
    return NextResponse.json({ error: "virtual_tryon_lock_failed" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleLockVirtualTryOnRequest(request, { params: await context.params });
}
