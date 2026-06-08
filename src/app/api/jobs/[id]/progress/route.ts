import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleJobProgressStore,
  getVideoJobProgress,
  type JobProgressStore,
} from "@/server/jobs/progress";

type JobProgressSession = {
  user?: {
    id?: string;
  };
} | null;

type JobProgressResult = Awaited<ReturnType<typeof getVideoJobProgress>>;

interface GetJobProgressRouteDeps {
  getSession?: () => Promise<JobProgressSession>;
  getProgress?: (input: {
    jobId: string;
    userId: string;
  }) => Promise<JobProgressResult>;
  store?: JobProgressStore;
}

async function defaultGetProgress({
  jobId,
  userId,
  store = createDrizzleJobProgressStore(),
}: {
  jobId: string;
  userId: string;
  store?: JobProgressStore;
}) {
  return getVideoJobProgress({ store, jobId, userId });
}

export async function handleGetJobProgressRequest(
  request: Request,
  context: { params: { id: string } },
  deps: GetJobProgressRouteDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const getProgress =
    deps.getProgress ??
    ((input: { jobId: string; userId: string }) =>
      defaultGetProgress({ ...input, store: deps.store }));
  const progress = await getProgress({
    jobId: context.params.id,
    userId,
  });

  if (!progress) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(progress);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleGetJobProgressRequest(request, { params: await context.params });
}
