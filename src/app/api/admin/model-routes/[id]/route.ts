import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  createDrizzleProviderOpsStore,
  type ProviderStatus,
  updateModelRoute,
} from "@/server/admin/providers";
import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";

const providerStatuses = ["active", "paused", "exhausted", "error"] as const;

interface UpdateModelRouteDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  updateRoute?: (input: {
    routeId: string;
    status?: ProviderStatus;
    primaryModel?: string;
    minMarginPercent?: number;
    allowPublicFallback?: boolean;
    reason: string;
  }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const status = providerStatuses.includes(record.status as ProviderStatus)
    ? (record.status as ProviderStatus)
    : undefined;
  const primaryModel =
    typeof record.primaryModel === "string" && record.primaryModel.trim()
      ? record.primaryModel.trim()
      : undefined;
  const minMarginPercent =
    typeof record.minMarginPercent === "number"
      ? record.minMarginPercent
      : undefined;
  const allowPublicFallback =
    typeof record.allowPublicFallback === "boolean"
      ? record.allowPublicFallback
      : undefined;
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (!reason) {
    throw new Error("invalid_model_route_input");
  }

  return {
    status,
    primaryModel,
    minMarginPercent,
    allowPublicFallback,
    reason,
  };
}

function defaultUpdateRoute({
  admin,
  request,
  routeId,
  status,
  primaryModel,
  minMarginPercent,
  allowPublicFallback,
  reason,
}: {
  admin: AdminSession;
  request: Request;
  routeId: string;
  status?: ProviderStatus;
  primaryModel?: string;
  minMarginPercent?: number;
  allowPublicFallback?: boolean;
  reason: string;
}) {
  return updateModelRoute({
    store: createDrizzleProviderOpsStore(),
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    routeId,
    status,
    primaryModel,
    minMarginPercent,
    allowPublicFallback,
    reason,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleUpdateModelRouteRequest(
  request: Request,
  context: { params: { id: string } },
  deps: UpdateModelRouteDeps = {},
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
      { error: "invalid_model_route_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.updateRoute ??
      ((args) => defaultUpdateRoute({ admin, request, ...args })))({
      routeId: context.params.id,
      ...input,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Actor cannot update model routes."
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "Model route not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "model_route_update_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleUpdateModelRouteRequest(request, {
    params: await context.params,
  });
}
