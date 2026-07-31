import { NextResponse } from "next/server";

import { createDrizzleAdminVirtualTryOnStore, getAdminVirtualTryOnDetail } from "@/server/admin/virtual-try-on";
import { getAdminSession, type AdminSession } from "@/server/auth/admin-session";

interface GetAdminVirtualTryOnDetailDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  getDetail?: (input: { jobId: string }) => Promise<unknown | null>;
}

export async function handleGetAdminVirtualTryOnDetailRequest(_request: Request, context: { params: { id: string } }, deps: GetAdminVirtualTryOnDetailDeps = {}) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const getDetail = deps.getDetail ?? ((input: { jobId: string }) => getAdminVirtualTryOnDetail({ store: createDrizzleAdminVirtualTryOnStore(), ...input }));
  const detail = await getDetail({ jobId: context.params.id });
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleGetAdminVirtualTryOnDetailRequest(request, { params: await context.params });
}
