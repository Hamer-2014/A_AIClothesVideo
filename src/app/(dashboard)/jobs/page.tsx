import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/shell";
import { JobList } from "@/components/jobs/job-list";
import { buildDashboardNav } from "@/app/app-shell";
import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleUserJobListStore,
  listUserJobs,
} from "@/server/jobs/list-jobs";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await getServerSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const jobs = await listUserJobs({
    store: createDrizzleUserJobListStore(),
    userId,
  });

  return (
    <DashboardShell
      title="任务历史"
      subtitle="这里只展示完整视频任务。8 秒片段只在后台排障时可见。"
      nav={buildDashboardNav("/jobs")}
    >
      <JobList jobs={jobs} />
    </DashboardShell>
  );
}
