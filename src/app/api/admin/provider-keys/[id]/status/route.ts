import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

interface UpdateProviderKeyStatusDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
}

export async function handleUpdateProviderKeyStatusRequest(
  _request: Request,
  _context: { params: { id: string } },
  deps: UpdateProviderKeyStatusDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ error: "provider_keys_retired" }, { status: 410 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleUpdateProviderKeyStatusRequest(request, {
    params: await context.params,
  });
}
