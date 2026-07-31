import Link from "next/link";
import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { createDrizzleAdminVirtualTryOnStore, listAdminVirtualTryOns } from "@/server/admin/virtual-try-on";
import { getAdminSession } from "@/server/auth/admin-session";

export const dynamic = "force-dynamic";

function pageLimit(value: string | string[] | undefined) {
  if (typeof value !== "string") return 25;
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= 50 ? limit : 25;
}

function pageCursor(value: string | string[] | undefined) {
  return typeof value === "string" && /^\d+\|[a-z0-9-]{1,128}$/iu.test(value) ? value : undefined;
}

function viewLabels(views: Array<"front" | "side" | "back">) {
  return views.map((view) => view === "front" ? "正面" : view === "side" ? "侧面" : "背面").join("、") || "-";
}

export default async function AdminVirtualTryOnPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/login");
  const params = searchParams ? await searchParams : {};
  const limit = pageLimit(params.limit);
  const cursor = pageCursor(params.cursor);
  const page = await listAdminVirtualTryOns({ store: createDrizzleAdminVirtualTryOnStore(), limit, cursor });

  return <AdminShell nav={buildAdminNav("/admin/virtual-try-on")} subtitle="按任务状态、所需视角和当前定妆包版本排查试穿交付；列表不展示素材路径或供应商原始内容。" title="虚拟试穿">
    <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-xs font-medium text-[var(--muted)]">
            <tr><th className="px-4 py-3">任务</th><th className="px-4 py-3">用户</th><th className="px-4 py-3">模式</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">定妆包</th><th className="px-4 py-3">创建时间</th><th className="px-4 py-3">详情</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {page.items.length === 0 ? <tr><td className="px-4 py-8 text-[var(--muted)]" colSpan={7}>暂无虚拟试穿任务。</td></tr> : page.items.map((job) => <tr key={job.id}>
              <td className="px-4 py-3 font-medium">{job.id}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{job.userId}</td>
              <td className="px-4 py-3">{job.mode === "three_view" ? "三视图" : "仅正面"}</td>
              <td className="px-4 py-3"><span className="inline-flex rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-1 text-xs font-medium">{job.status}</span></td>
              <td className="px-4 py-3 text-[var(--muted)]">{job.pack ? `v${job.pack.version} · ${viewLabels(job.pack.requiredViews)}` : "未创建"}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{job.createdAt.toLocaleString("zh-CN")}</td>
              <td className="px-4 py-3"><Link className="text-[var(--accent)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" href={`/admin/virtual-try-on/${job.id}`}>查看</Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {page.nextCursor ? <div className="border-t border-[var(--line)] px-4 py-3"><Link className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-[var(--line)] px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" href={`/admin/virtual-try-on?limit=${limit}&cursor=${encodeURIComponent(page.nextCursor)}`}>下一页</Link></div> : null}
    </section>
  </AdminShell>;
}
