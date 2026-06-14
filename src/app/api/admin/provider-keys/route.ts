import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

interface CreateProviderKeyDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
}

export async function handleCreateProviderKeyRequest(
  _request: Request,
  deps: CreateProviderKeyDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ error: "provider_keys_retired" }, { status: 410 });
}

export async function POST(request: Request) {
  return handleCreateProviderKeyRequest(request);
}
