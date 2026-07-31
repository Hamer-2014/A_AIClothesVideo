import { NextResponse } from "next/server";

import { createDrizzleAdminVirtualTryOnStore, listAdminVirtualTryOns } from "@/server/admin/virtual-try-on";
import { getAdminSession, type AdminSession } from "@/server/auth/admin-session";

type ListResult = Awaited<ReturnType<typeof listAdminVirtualTryOns>>;

interface GetAdminVirtualTryOnListDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  list?: (input: { limit: number; cursor?: string }) => Promise<ListResult>;
}

function listInput(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = limitParam === null ? 25 : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return null;
  if (cursor !== undefined && (!/^\d+\|[a-z0-9-]{1,128}$/iu.test(cursor) || cursor.length > 160)) return null;
  return { limit, cursor };
}

export async function handleGetAdminVirtualTryOnListRequest(request: Request, deps: GetAdminVirtualTryOnListDeps = {}) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const input = listInput(request);
  if (!input) return NextResponse.json({ error: "invalid_pagination" }, { status: 400 });
  const list = deps.list ?? ((value: { limit: number; cursor?: string }) => listAdminVirtualTryOns({ store: createDrizzleAdminVirtualTryOnStore(), ...value }));
  return NextResponse.json(await list(input));
}

export async function GET(request: Request) {
  return handleGetAdminVirtualTryOnListRequest(request);
}
