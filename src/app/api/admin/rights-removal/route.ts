import { NextResponse } from "next/server";

import {
  createDrizzleAdminRightsRemovalStore,
  listRightsRemovalRequests,
} from "@/server/admin/rights-removal";
import type {
  RightsRemovalStatus,
  RightsType,
} from "@/server/compliance/rights-removal";
import { getAdminSession, type AdminSession } from "@/server/auth/admin-session";

const statuses = new Set<RightsRemovalStatus>([
  "received",
  "triaging",
  "awaiting_information",
  "action_required",
  "resolved_removed",
  "resolved_rejected",
]);
const rightsTypes = new Set<RightsType>([
  "likeness",
  "copyright",
  "trademark",
  "privacy",
  "other",
]);

interface GetRightsRemovalDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  listRequests?: (filters: {
    status?: RightsRemovalStatus;
    rightsType?: RightsType;
    limit?: number;
  }) => Promise<unknown>;
}

export async function handleGetRightsRemovalRequests(
  request: Request,
  deps: GetRightsRemovalDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusValue = url.searchParams.get("status");
  const rightsTypeValue = url.searchParams.get("rightsType");
  const limitValue = Number(url.searchParams.get("limit"));
  const filters = {
    status:
      statusValue && statuses.has(statusValue as RightsRemovalStatus)
        ? (statusValue as RightsRemovalStatus)
        : undefined,
    rightsType:
      rightsTypeValue && rightsTypes.has(rightsTypeValue as RightsType)
        ? (rightsTypeValue as RightsType)
        : undefined,
    limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : undefined,
  };
  const requests = await (
    deps.listRequests ??
    ((nextFilters) =>
      listRightsRemovalRequests({
        store: createDrizzleAdminRightsRemovalStore(),
        filters: nextFilters,
      }))
  )(filters);

  return NextResponse.json({ requests });
}

export async function GET(request: Request) {
  return handleGetRightsRemovalRequests(request);
}
