import Link from "next/link";
import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminSession } from "@/server/auth/admin-session";
import {
  createDrizzleAdminJobLedgerSummaryStore,
  createDrizzleAdminJobListStore,
  listAdminJobs,
} from "@/server/admin/list-jobs";

export const dynamic = "force-dynamic";

function toBooleanFilter(value: string | undefined) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const attention = resolvedSearchParams?.attention === "1";
  const failureQueue = resolvedSearchParams?.failureQueue === "1";
  const isTest = toBooleanFilter(
    typeof resolvedSearchParams?.isTest === "string"
      ? resolvedSearchParams.isTest
      : undefined,
  );
  const status =
    typeof resolvedSearchParams?.status === "string"
      ? resolvedSearchParams.status
      : undefined;
  const billingMode =
    typeof resolvedSearchParams?.billingMode === "string"
      ? resolvedSearchParams.billingMode
      : undefined;
  const presetId =
    typeof resolvedSearchParams?.presetId === "string"
      ? resolvedSearchParams.presetId
      : undefined;
  const query =
    typeof resolvedSearchParams?.q === "string" ? resolvedSearchParams.q : undefined;

  const jobs = await listAdminJobs({
    store: createDrizzleAdminJobListStore(),
    ledgerSummaryStore: createDrizzleAdminJobLedgerSummaryStore(),
    filters: {
      attention,
      failureQueue,
      isTest,
      status,
      billingMode,
      presetId,
      query,
    },
  });

  return (
    <AdminShell
      title="任务管理"
      subtitle="按真实状态查看用户任务、失败原因和测试/正式标记。"
      nav={buildAdminNav("/admin/jobs")}
    >
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(6,minmax(0,0.7fr))_auto]">
          <input
            className="h-10 rounded-md border border-[var(--line)] px-3 text-sm outline-none ring-0 transition focus:border-[var(--accent)]"
            defaultValue={query ?? ""}
            name="q"
            placeholder="搜索 jobId 或 userId"
            type="search"
          />
          <select
            className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
            defaultValue={attention ? "1" : "0"}
            name="attention"
          >
            <option value="0">全部任务</option>
            <option value="1">只看异常</option>
          </select>
          <select
            className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
            defaultValue={failureQueue ? "1" : "0"}
            name="failureQueue"
          >
            <option value="0">全部队列</option>
            <option value="1">失败队列</option>
          </select>
          <select
            className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
            defaultValue={typeof isTest === "boolean" ? String(isTest) : ""}
            name="isTest"
          >
            <option value="">测试/正式全部</option>
            <option value="true">仅测试</option>
            <option value="false">仅正式</option>
          </select>
          <select
            className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
            defaultValue={billingMode ?? ""}
            name="billingMode"
          >
            <option value="">计费全部</option>
            <option value="free_trial">免费试用</option>
            <option value="paid">付费</option>
          </select>
          <input
            className="h-10 rounded-md border border-[var(--line)] px-3 text-sm outline-none ring-0 transition focus:border-[var(--accent)]"
            defaultValue={presetId ?? ""}
            name="presetId"
            placeholder="presetId"
            type="text"
          />
          <input
            className="h-10 rounded-md border border-[var(--line)] px-3 text-sm outline-none ring-0 transition focus:border-[var(--accent)]"
            defaultValue={status ?? ""}
            name="status"
            placeholder="按状态筛选"
            type="text"
          />
          <button
            className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--ink)] bg-[var(--ink)] px-4 text-sm font-medium text-white"
            type="submit"
          >
            筛选
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            className="inline-flex h-8 items-center rounded-md border border-[var(--line)] px-3 text-[var(--muted)]"
            href="/admin/jobs"
          >
            清空筛选
          </Link>
          <Link
            className="inline-flex h-8 items-center rounded-md border border-[var(--line)] px-3 text-[var(--muted)]"
            href="/admin/jobs?failureQueue=1"
          >
            失败队列
          </Link>
          <Link
            className="inline-flex h-8 items-center rounded-md border border-[var(--line)] px-3 text-[var(--muted)]"
            href="/admin/jobs?attention=1"
          >
            异常/卡住
          </Link>
          <Link
            className="inline-flex h-8 items-center rounded-md border border-[var(--line)] px-3 text-[var(--muted)]"
            href="/admin/jobs?isTest=true"
          >
            测试任务
          </Link>
          <Link
            className="inline-flex h-8 items-center rounded-md border border-[var(--line)] px-3 text-[var(--muted)]"
            href="/admin/jobs?isTest=false"
          >
            正式任务
          </Link>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-[var(--line)] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--line)] text-sm">
            <thead className="bg-[var(--surface)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">用户态</th>
                <th className="px-4 py-3 font-medium">计费</th>
                <th className="px-4 py-3 font-medium">Preset</th>
                <th className="px-4 py-3 font-medium">时长 / 比例</th>
                <th className="px-4 py-3 font-medium">点数</th>
                <th className="px-4 py-3 font-medium">账务</th>
                <th className="px-4 py-3 font-medium">测试</th>
                <th className="px-4 py-3 font-medium">失败原因</th>
                <th className="px-4 py-3 font-medium">创建时间</th>
                <th className="px-4 py-3 font-medium">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {jobs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-[var(--muted)]" colSpan={13}>
                    当前筛选条件下没有任务。
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr className="align-top" key={job.id}>
                    <td className="px-4 py-4 font-medium">{job.id}</td>
                    <td className="px-4 py-4 text-[var(--muted)]">{job.userId}</td>
                    <td className="px-4 py-4">{job.status}</td>
                    <td className="px-4 py-4">{job.userVisibleStatus}</td>
                    <td className="px-4 py-4">{job.billingMode}</td>
                    <td className="px-4 py-4">{job.presetId ?? "-"}</td>
                    <td className="px-4 py-4">
                      {job.durationSeconds} 秒 / {job.aspectRatio}
                    </td>
                    <td className="px-4 py-4">{job.creditCost}</td>
                    <td className="px-4 py-4">
                      {job.status === "deliverable" && job.creditCost > 0 ? (
                        job.hasCapture ? (
                          "已 capture"
                        ) : (
                          <span className="font-medium text-[var(--accent)]">
                            未 capture
                          </span>
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-4">{job.isTest ? "测试" : "正式"}</td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {job.failureReason ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {new Date(job.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        className="text-[var(--accent)] underline underline-offset-2"
                        href={`/admin/jobs/${job.id}`}
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
