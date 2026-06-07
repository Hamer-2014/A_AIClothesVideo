import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  createDrizzleProviderOpsStore,
  getProviderOpsOverview,
} from "@/server/admin/providers";

interface GetProvidersDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  getOverview?: () => Promise<unknown>;
}

function defaultGetOverview() {
  return getProviderOpsOverview({
    store: createDrizzleProviderOpsStore(),
  });
}

export async function handleGetProvidersRequest(
  _request: Request,
  deps: GetProvidersDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(await (deps.getOverview ?? defaultGetOverview)());
}

export async function GET(request: Request) {
  return handleGetProvidersRequest(request);
}
