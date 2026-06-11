import { NextResponse } from "next/server";

import {
  createDrizzleAdminAuditStore,
  listAdminAuditLogs,
  type AdminAuditFilters,
} from "@/server/admin/audit";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

interface GetAuditLogsDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  listLogs?: (filters: AdminAuditFilters) => Promise<unknown>;
}

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function defaultListLogs(filters: AdminAuditFilters) {
  return listAdminAuditLogs({
    store: createDrizzleAdminAuditStore(),
    filters,
  });
}

export async function handleGetAuditLogsRequest(
  request: Request,
  deps: GetAuditLogsDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters: AdminAuditFilters = {
    actorEmail: url.searchParams.get("actorEmail") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    targetType: url.searchParams.get("targetType") ?? undefined,
    targetId: url.searchParams.get("targetId") ?? undefined,
    limit: parseLimit(url.searchParams.get("limit")),
  };

  const auditLogs = await (deps.listLogs ?? defaultListLogs)(filters);

  return NextResponse.json({ auditLogs });
}

export async function GET(request: Request) {
  return handleGetAuditLogsRequest(request);
}
