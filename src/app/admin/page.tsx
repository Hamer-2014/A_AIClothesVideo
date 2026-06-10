import Link from "next/link";
import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSession } from "@/server/auth/admin-session";
import {
  createDrizzleAdminJobListStore,
  listAdminJobs,
} from "@/server/admin/list-jobs";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const jobs = await listAdminJobs({
    store: createDrizzleAdminJobListStore(),
  });
  const failedJobs = jobs.filter((job) => job.status.startsWith("failed"));
  const activeJobs = jobs.filter(
    (job) => !job.status.startsWith("failed") && job.status !== "deliverable",
  );

  return (
    <AdminShell
      title="后台总览"
      subtitle="后台不是装饰性 dashboard。这里优先给运营和工程看到当前最需要排障的任务。"
      nav={buildAdminNav("/admin")}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Active Jobs
          </p>
          <p className="mt-3 text-3xl font-semibold">{activeJobs.length}</p>
        </section>
        <section className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Failed Jobs
          </p>
          <p className="mt-3 text-3xl font-semibold">{failedJobs.length}</p>
        </section>
        <section className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Recent Jobs
          </p>
          <p className="mt-3 text-3xl font-semibold">{jobs.length}</p>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="text-base font-medium">最近失败任务</h2>
        <div className="mt-4 space-y-3">
          {failedJobs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">当前没有失败任务。</p>
          ) : (
            failedJobs.slice(0, 8).map((job) => (
              <Link
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
                href={`/admin/jobs/${job.id}`}
                key={job.id}
              >
                <div>
                  <p className="text-sm font-medium">{job.id}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {job.failureReason ?? job.status}
                  </p>
                </div>
                <p className="text-xs text-[var(--muted)]">{job.userId}</p>
              </Link>
            ))
          )}
        </div>
      </section>
    </AdminShell>
  );
}
