import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  attestAssets as attestExistingAssets,
  parseRightsAttestation,
  type AttestAssetsInput,
} from "@/server/compliance/rights-attestation";

type AttestRightsSession = {
  user?: { id?: string };
} | null;

interface AttestAssetRightsDeps {
  getSession?: () => Promise<AttestRightsSession>;
  attestAssets?: (input: AttestAssetsInput) => Promise<{
    attestationId: string;
    assetIds: string[];
  }>;
}

function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

function requestLocale(request: Request) {
  return (
    request.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.trim() ||
    "zh-CN"
  );
}

export async function handleAttestAssetRightsRequest(
  request: Request,
  deps: AttestAssetRightsDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const assetIds = Array.isArray(body.assetIds)
    ? body.assetIds.filter((assetId): assetId is string => typeof assetId === "string")
    : [];

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

  try {
    const result = await (deps.attestAssets ?? attestExistingAssets)({
      userId,
      assetIds,
      attestation,
      locale: requestLocale(request),
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "invalid_asset_ids") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    if (code === "rights_attestation_asset_not_found") {
      return NextResponse.json({ error: code }, { status: 404 });
    }
    if (code === "compliance_hash_secret_required") {
      return NextResponse.json({ error: code }, { status: 503 });
    }
    return NextResponse.json(
      { error: "rights_attestation_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleAttestAssetRightsRequest(request);
}
