import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { stylePresets } from "@/lib/presets";
import {
  createDrizzleVirtualTryOnVideoBridgeStore,
  createVirtualTryOnVideo,
  type VirtualTryOnVideoBridgeRequest,
} from "@/server/virtual-tryon/video-bridge";

type Session = { user?: { id?: string } } | null;
type BridgeResult = Awaited<ReturnType<typeof createVirtualTryOnVideo>>;

interface CreateVirtualTryOnVideoRouteDeps {
  getSession?: () => Promise<Session>;
  createBridge?: (input: VirtualTryOnVideoBridgeRequest) => Promise<BridgeResult>;
}

const durations = new Set([8, 16, 24, 32]);
const aspectRatios = new Set(["9:16", "1:1", "16:9"]);

function parseInput(value: unknown, userId: string, jobId: string): VirtualTryOnVideoBridgeRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.packId !== "string"
    || typeof input.idempotencyKey !== "string"
    || input.idempotencyKey.trim().length < 8
    || input.idempotencyKey.length > 128
    || typeof input.durationSeconds !== "number"
    || !durations.has(input.durationSeconds)
    || typeof input.aspectRatio !== "string"
    || !aspectRatios.has(input.aspectRatio)
    || typeof input.presetId !== "string"
    || !stylePresets.some((preset) => preset.id === input.presetId)
  ) return null;
  return {
    userId,
    jobId,
    packId: input.packId,
    idempotencyKey: input.idempotencyKey,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio as VirtualTryOnVideoBridgeRequest["aspectRatio"],
    presetId: input.presetId,
  };
}

const conflictErrors = new Set([
  "appearance_pack_not_latest",
  "appearance_pack_not_locked",
  "appearance_pack_strict_qa_required",
  "appearance_pack_source_rights_revoked",
  "appearance_pack_asset_incomplete",
  "video_bridge_idempotency_mismatch",
  "video_bridge_in_progress",
]);

export async function handleCreateVirtualTryOnVideoRequest(
  request: Request,
  context: { params: { id: string } },
  deps: CreateVirtualTryOnVideoRouteDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = parseInput(await request.json().catch(() => null), userId, context.params.id);
  if (!input) return NextResponse.json({ error: "invalid_video_bridge_input" }, { status: 400 });
  const createBridge = deps.createBridge ?? ((bridgeInput) => createVirtualTryOnVideo(bridgeInput, { store: createDrizzleVirtualTryOnVideoBridgeStore() }));

  try {
    const result = await createBridge(input);
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "invalid_video_bridge_input") return NextResponse.json({ error: message }, { status: 400 });
    if (message === "appearance_pack_not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (conflictErrors.has(message)) return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json({ error: "video_bridge_failed" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleCreateVirtualTryOnVideoRequest(request, { params: await context.params });
}
