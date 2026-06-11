import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  createDrizzleProviderOpsStore,
  type ProviderStatus,
  updateProviderKeyStatus,
} from "@/server/admin/providers";
import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";

const providerStatuses = ["active", "paused", "exhausted", "error"] as const;

interface UpdateProviderKeyStatusDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  updateStatus?: (input: {
    keyId: string;
    status: ProviderStatus;
    reason: string;
  }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const status = record.status;
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (
    !providerStatuses.includes(status as ProviderStatus) ||
    reason.length < 6
  ) {
    throw new Error("invalid_provider_key_status_input");
  }

  return {
    status: status as ProviderStatus,
    reason,
  };
}

function defaultUpdateStatus({
  admin,
  request,
  keyId,
  status,
  reason,
}: {
  admin: AdminSession;
  request: Request;
  keyId: string;
  status: ProviderStatus;
  reason: string;
}) {
  return updateProviderKeyStatus({
    store: createDrizzleProviderOpsStore(),
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    keyId,
    status,
    reason,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleUpdateProviderKeyStatusRequest(
  request: Request,
  context: { params: { id: string } },
  deps: UpdateProviderKeyStatusDeps = {},
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
      { error: "invalid_provider_key_status_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.updateStatus ??
      ((args) => defaultUpdateStatus({ admin, request, ...args })))({
      keyId: context.params.id,
      ...input,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Actor cannot update provider keys."
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      error instanceof Error &&
      error.message === "Admin action reason must be at least 6 characters."
    ) {
      return NextResponse.json(
        { error: "invalid_provider_key_status_input" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "Provider key not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "provider_key_update_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleUpdateProviderKeyStatusRequest(request, {
    params: await context.params,
  });
}
