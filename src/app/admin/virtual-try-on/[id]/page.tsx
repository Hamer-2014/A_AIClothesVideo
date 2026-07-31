import Link from "next/link";
import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { createDrizzleAdminVirtualTryOnStore, getAdminVirtualTryOnDetail } from "@/server/admin/virtual-try-on";
import { getAdminSession } from "@/server/auth/admin-session";

export const dynamic = "force-dynamic";

function value(value: unknown) {
  return JSON.stringify(value) ?? "-";
}

export default async function AdminVirtualTryOnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) redirect("/login");
  const { id } = await params;
  const detail = await getAdminVirtualTryOnDetail({ store: createDrizzleAdminVirtualTryOnStore(), jobId: id });
  if (!detail) redirect("/admin/virtual-try-on");

  return <AdminShell nav={buildAdminNav("/admin/virtual-try-on")} subtitle="仅展示脱敏后的 provider、QA、账本和状态事件，用于排障与审计；不包含签名 URL、请求快照或完整对象存储路径。" title={`虚拟试穿 ${detail.job.id.slice(0, 8)}`}>
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p><span className="font-medium">用户：</span>{detail.job.userId} <span className="ml-3 font-medium">模式：</span>{detail.job.mode} <span className="ml-3 font-medium">状态：</span>{detail.job.status}</p>
        <Link className="text-[var(--accent)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" href="/admin/virtual-try-on">返回列表</Link>
      </div>

      <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)]">
        <div className="border-b border-[var(--line)] px-4 py-3"><h2 className="text-base font-semibold">视角</h2></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[var(--surface-subtle)] text-xs text-[var(--muted)]"><tr><th className="px-4 py-3">视角</th><th className="px-4 py-3">Provider 状态</th><th className="px-4 py-3">尝试</th><th className="px-4 py-3">错误码</th><th className="px-4 py-3">R2 后缀</th><th className="px-4 py-3">来源</th><th className="px-4 py-3">Provenance</th></tr></thead><tbody className="divide-y divide-[var(--line)]">{detail.views.map((view) => <tr key={view.id}><td className="px-4 py-3 font-medium">{view.view}</td><td className="px-4 py-3">{view.providerStatus}</td><td className="px-4 py-3">{view.attemptCount}</td><td className="px-4 py-3">{view.lastErrorCode ?? "-"}</td><td className="px-4 py-3 font-mono text-xs">{view.r2KeySuffix ?? "-"}</td><td className="px-4 py-3">{view.origin}</td><td className="px-4 py-3"><pre className="max-w-80 overflow-x-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">{value(view.provenance)}</pre></td></tr>)}</tbody></table></div>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)]">
        <div className="border-b border-[var(--line)] px-4 py-3"><h2 className="text-base font-semibold">QA 与账本</h2></div>
        <div className="grid gap-6 p-4 xl:grid-cols-2">
          <div><h3 className="text-sm font-semibold">严格 QA</h3><div className="mt-3 space-y-3">{detail.fidelity.map((result) => <div className="border-l-2 border-[var(--line-strong)] pl-3 text-sm" key={result.id}><p>{result.scope}{result.view ? ` · ${result.view}` : ""} · <span className="font-medium">{result.verdict}</span></p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">{value(result.resultJson)}</pre></div>)}</div></div>
          <div><h3 className="text-sm font-semibold">账本关联</h3><dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm"><dt className="text-[var(--muted)]">Reserve</dt><dd className="break-all font-mono text-xs">{detail.ledger.reservedLedgerId ?? "-"}</dd><dt className="text-[var(--muted)]">Capture</dt><dd className="break-all font-mono text-xs">{detail.ledger.capturedLedgerId ?? "-"}</dd><dt className="text-[var(--muted)]">Release</dt><dd className="break-all font-mono text-xs">{detail.ledger.releasedLedgerId ?? "-"}</dd><dt className="text-[var(--muted)]">Refund</dt><dd className="break-all font-mono text-xs">{detail.ledger.refundedLedgerId ?? "-"}</dd></dl><h3 className="mt-6 text-sm font-semibold">Provider 调用</h3><div className="mt-3 space-y-2 text-sm">{detail.providerLogs.map((log) => <p className="border-l-2 border-[var(--line-strong)] pl-3" key={log.id}>{log.provider} · {log.model} · {log.purpose} · {log.status} · task {log.providerTaskId ?? "-"} · cost {log.costEstimate ?? "-"} · code {log.errorCode ?? "-"}</p>)}</div></div>
        </div>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)]">
        <div className="border-b border-[var(--line)] px-4 py-3"><h2 className="text-base font-semibold">状态事件</h2></div>
        <ol className="divide-y divide-[var(--line)]">{detail.stateEvents.map((event) => <li className="px-4 py-3 text-sm" key={event.id}><p className="font-medium">{event.fromStatus ?? "-"} → {event.toStatus} · {event.reason}</p><p className="mt-1 text-xs text-[var(--muted)]">{event.actorType} · {event.createdAt.toLocaleString("zh-CN")}</p><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">{value(event.eventSnapshot)}</pre></li>)}</ol>
      </section>
    </div>
  </AdminShell>;
}
