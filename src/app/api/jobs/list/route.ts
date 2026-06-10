import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleUserJobListStore,
  listUserJobs,
} from "@/server/jobs/list-jobs";

type JobListSession = {
  user?: {
    id?: string;
  };
} | null;

interface GetJobListDeps {
  getSession?: () => Promise<JobListSession>;
  getJobs?: (input: { userId: string }) => Promise<unknown>;
}

function defaultGetJobs(input: { userId: string }) {
  return listUserJobs({
    store: createDrizzleUserJobListStore(),
    userId: input.userId,
  });
}

export async function handleGetJobListRequest(
  _request: Request,
  deps: GetJobListDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    await (deps.getJobs ?? defaultGetJobs)({ userId }),
  );
}

export async function GET(request: Request) {
  return handleGetJobListRequest(request);
}
