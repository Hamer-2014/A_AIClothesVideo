import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

interface UpdateModelRouteDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
}

export async function handleUpdateModelRouteRequest(
  _request: Request,
  _context: { params: { id: string } },
  deps: UpdateModelRouteDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ error: "model_routes_retired" }, { status: 410 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleUpdateModelRouteRequest(request, {
    params: await context.params,
  });
}
