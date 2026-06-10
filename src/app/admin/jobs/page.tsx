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

export default async function AdminJobsPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const jobs = await listAdminJobs({
    store: createDrizzleAdminJobListStore(),
  });

  return (
    <AdminShell
      title="任务管理"
      subtitle="按真实状态查看用户任务、失败原因和测试/正式标记。"
      nav={buildAdminNav("/admin/jobs")}
    >
      <div className="space-y-3">
        {jobs.map((job) => (
          <Link
            className="block rounded-lg border border-[var(--line)] bg-white px-5 py-4"
            href={`/admin/jobs/${job.id}`}
            key={job.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{job.id}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {job.userId} · {job.durationSeconds} 秒 / {job.aspectRatio}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {job.failureReason ?? job.status}
                </p>
              </div>
              <div className="text-right text-xs text-[var(--muted)]">
                <p>{job.isTest ? "测试" : "正式"}</p>
                <p className="mt-1">{new Date(job.createdAt).toLocaleString("zh-CN")}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
