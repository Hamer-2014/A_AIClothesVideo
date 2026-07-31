import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { createVirtualTryOn } from "@/server/virtual-tryon/create";
import type { VirtualTryOnMode } from "@/server/virtual-tryon/config";
import { createDrizzleVirtualTryOnStore, type VirtualTryOnStore } from "@/server/virtual-tryon/store";

type Session = { user?: { id?: string } } | null;
type CreateInput = Parameters<typeof createVirtualTryOn>[0];
type CreateResult = { job: { id: string; status: string }; pack: { id: string } };

interface CreateVirtualTryOnRouteDeps {
  getSession?: () => Promise<Session>;
  createVirtualTryOn?: (input: CreateInput) => Promise<CreateResult>;
  store?: VirtualTryOnStore;
  creditStore?: CreditLedgerStore;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength
    ? value.trim()
    : null;
}

function parseInput(body: unknown): Omit<CreateInput, "userId" | "key"> | null {
  if (!isRecord(body) || Object.keys(body).some((key) => !["mode", "skuName", "sourceAssetIds"].includes(key))) return null;
  const mode = body.mode === "front_only" || body.mode === "three_view" ? body.mode : null;
  const sources = isRecord(body.sourceAssetIds) ? body.sourceAssetIds : null;
  if (!mode || !sources || Object.keys(sources).some((key) => !["front", "back", "detail"].includes(key))) return null;
  const front = nonEmptyString(sources.front, 128);
  const back = sources.back === undefined ? undefined : nonEmptyString(sources.back, 128);
  const detail = sources.detail === undefined ? undefined : nonEmptyString(sources.detail, 128);
  if (!front || back === null || detail === null) return null;
  if (mode === "three_view" && (!back || !detail)) return null;
  if (body.skuName !== undefined && (typeof body.skuName !== "string" || body.skuName.trim().length > 80)) return null;
  const skuName = typeof body.skuName === "string" ? body.skuName.trim() || undefined : undefined;
  return { mode: mode as VirtualTryOnMode, skuName, sourceAssetIds: { front, ...(back ? { back } : {}), ...(detail ? { detail } : {}) } };
}

function creationErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (["virtual_tryon_asset_rights_required", "virtual_tryon_asset_role_mismatch", "virtual_tryon_duplicate_source_asset", "front_only_requires_front", "three_view_requires_front_back_detail"].includes(message)) return 400;
  if (["Insufficient available credits.", "virtual_tryon_failed_unreserved"].includes(message)) return 402;
  if (message === "virtual_tryon_idempotency_conflict") return 409;
  if (["virtual_tryon_config_unavailable", "virtual_tryon_moderation_blocked", "virtual_tryon_reserve_retry_scheduled"].includes(message)) return 503;
  return 500;
}

export async function handleCreateVirtualTryOnRequest(request: Request, deps: CreateVirtualTryOnRouteDeps = {}) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = nonEmptyString(request.headers.get("Idempotency-Key"), 128);
  const parsed = parseInput(await request.json().catch(() => null));
  if (!key || !parsed) return NextResponse.json({ error: "invalid_virtual_tryon_input" }, { status: 400 });
  const create = deps.createVirtualTryOn ?? ((input: CreateInput) => createVirtualTryOn(input, { store: deps.store ?? createDrizzleVirtualTryOnStore(), creditStore: deps.creditStore ?? createDrizzleCreditLedgerStore() }));
  try {
    const result = await create({ userId, key, ...parsed });
    return NextResponse.json({ jobId: result.job.id, status: result.job.status, packId: result.pack.id }, { status: 201 });
  } catch (error) {
    const status = creationErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "virtual_tryon_creation_failed" : status === 503 ? "virtual_tryon_unavailable" : status === 409 ? "virtual_tryon_idempotency_conflict" : status === 402 ? "insufficient_credits" : "invalid_virtual_tryon_input" }, { status });
  }
}

export async function POST(request: Request) {
  return handleCreateVirtualTryOnRequest(request);
}
