import { NextResponse } from "next/server";

import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";
import {
  createDrizzleProviderOpsStore,
  createProviderKey,
  type ProviderStatus,
} from "@/server/admin/providers";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

const providerStatuses = ["active", "paused", "exhausted", "error"] as const;

interface CreateProviderKeyDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  createKey?: (input: {
    providerId: string;
    label: string;
    environment: string;
    plainKey: string;
    dailyCostLimit: string;
    concurrentLimit: number;
    status: ProviderStatus;
    reason: string;
  }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const providerId =
    typeof record.providerId === "string" ? record.providerId.trim() : "";
  const label = typeof record.label === "string" ? record.label.trim() : "";
  const environment =
    typeof record.environment === "string"
      ? record.environment.trim()
      : "development";
  const plainKey =
    typeof record.plainKey === "string" ? record.plainKey.trim() : "";
  const dailyCostLimit =
    typeof record.dailyCostLimit === "string"
      ? record.dailyCostLimit.trim()
      : String(record.dailyCostLimit ?? "0");
  const concurrentLimit = Number(record.concurrentLimit ?? 1);
  const status = record.status;
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (
    !providerId ||
    !label ||
    !plainKey ||
    !Number.isFinite(concurrentLimit) ||
    concurrentLimit < 1 ||
    !providerStatuses.includes(status as ProviderStatus) ||
    reason.length < 6
  ) {
    throw new Error("invalid_provider_key_input");
  }

  return {
    providerId,
    label,
    environment,
    plainKey,
    dailyCostLimit,
    concurrentLimit,
    status: status as ProviderStatus,
    reason,
  };
}

function defaultCreateKey({
  admin,
  request,
  input,
}: {
  admin: AdminSession;
  request: Request;
  input: ReturnType<typeof parseBody>;
}) {
  return createProviderKey({
    store: createDrizzleProviderOpsStore(),
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    input,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleCreateProviderKeyRequest(
  request: Request,
  deps: CreateProviderKeyDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let input: ReturnType<typeof parseBody>;
  try {
    input = parseBody(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json(
      { error: "invalid_provider_key_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.createKey ??
      ((args) => defaultCreateKey({ admin, request, input: args })))(input);
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Actor cannot create provider keys."
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      error instanceof Error &&
      error.message.includes("PROVIDER_KEY_ENCRYPTION_SECRET")
    ) {
      return NextResponse.json(
        { error: "provider_key_encryption_unavailable" },
        { status: 503 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "Admin action reason must be at least 6 characters."
    ) {
      return NextResponse.json(
        { error: "invalid_provider_key_input" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "provider_key_create_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleCreateProviderKeyRequest(request);
}
