import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  createDrizzleAdminJobStore,
  getAdminJobDetail,
} from "@/server/admin/jobs";

interface GetAdminJobDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  getJobDetail?: (input: { jobId: string }) => Promise<unknown | null>;
}

function defaultGetJobDetail(input: { jobId: string }) {
  return getAdminJobDetail({
    store: createDrizzleAdminJobStore(),
    jobId: input.jobId,
  });
}

export async function handleGetAdminJobRequest(
  _request: Request,
  context: { params: { id: string } },
  deps: GetAdminJobDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const detail = await (deps.getJobDetail ?? defaultGetJobDetail)({
    jobId: context.params.id,
  });

  if (!detail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleGetAdminJobRequest(request, { params: await context.params });
}
