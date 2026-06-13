import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/shell";
import { JobList } from "@/components/jobs/job-list";
import { buildDashboardNav } from "@/app/app-shell";
import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleUserJobListStore,
  listUserJobs,
} from "@/server/jobs/list-jobs";
import {
  createDrizzleUserBillingStore,
  getUserBillingOverview,
} from "@/server/billing/user-billing";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await getServerSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const [jobs, overview] = await Promise.all([
    listUserJobs({
      store: createDrizzleUserJobListStore(),
      userId,
    }),
    getUserBillingOverview({
      store: createDrizzleUserBillingStore(),
      userId,
    }),
  ]);

  return (
    <DashboardShell
      title="任务历史"
      subtitle="这里只展示完整视频任务。8 秒片段只在后台排障时可见。"
      nav={buildDashboardNav("/jobs")}
      user={session.user}
      billing={overview.wallet}
    >
      <JobList
        jobs={jobs.map((job) => ({
          ...job,
          coverUrl: job.coverKey ? `/api/jobs/${job.id}/cover` : null,
        }))}
      />
    </DashboardShell>
  );
}
