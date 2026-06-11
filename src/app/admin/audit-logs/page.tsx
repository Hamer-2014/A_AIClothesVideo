import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  createDrizzleAdminAuditStore,
  listAdminAuditLogs,
} from "@/server/admin/audit";
import { getAdminSession } from "@/server/auth/admin-session";

export const dynamic = "force-dynamic";

interface AdminAuditLogsPageProps {
  searchParams?: Promise<{
    actorEmail?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
  }>;
}

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN");
}

function summarizeSnapshot(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return JSON.stringify(value).slice(0, 240);
}

export default async function AdminAuditLogsPage({
  searchParams,
}: AdminAuditLogsPageProps) {
  const admin = await getAdminSession();
  if (!admin || admin.role !== "admin") {
    redirect("/login");
  }

  const params = await searchParams;
  const auditLogs = await listAdminAuditLogs({
    store: createDrizzleAdminAuditStore(),
    filters: {
      actorEmail: params?.actorEmail,
      action: params?.action,
      targetType: params?.targetType,
      targetId: params?.targetId,
      limit: 50,
    },
  });

  return (
    <AdminShell
      title="审计日志"
      subtitle="查询后台敏感操作留痕。快查 actor、action 和 target，比翻数据库更稳。"
      nav={buildAdminNav("/admin/audit-logs")}
    >
      <div className="space-y-6">
        <form className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-5 md:grid-cols-4">
          {[
            ["actorEmail", "Actor Email"],
            ["action", "Action"],
            ["targetType", "Target Type"],
            ["targetId", "Target ID"],
          ].map(([name, label]) => (
            <label className="block" htmlFor={`audit-${name}`} key={name}>
              <span className="mb-2 block text-xs font-medium text-[var(--muted)]">
                {label}
              </span>
              <input
                className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                defaultValue={params?.[name as keyof Awaited<AdminAuditLogsPageProps["searchParams"]>] ?? ""}
                id={`audit-${name}`}
                name={name}
              />
            </label>
          ))}
          <div className="md:col-span-4">
            <button
              className="inline-flex h-10 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white"
              type="submit"
            >
              查询
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h3 className="text-base font-medium">Audit Logs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--line)] text-sm">
              <thead className="bg-[var(--surface)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  {[
                    "Created",
                    "Actor",
                    "Action",
                    "Target",
                    "Reason",
                    "IP",
                    "User Agent",
                    "Before",
                    "After",
                  ].map((column) => (
                    <th className="px-4 py-3 font-medium" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[var(--muted)]" colSpan={9}>
                      当前没有审计日志。
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr className="align-top" key={log.id}>
                      <td className="px-4 py-4">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-4">{log.actorEmail ?? "-"}</td>
                      <td className="px-4 py-4">{log.action}</td>
                      <td className="px-4 py-4">
                        {log.targetType}
                        <br />
                        <span className="text-xs text-[var(--muted)]">
                          {log.targetId ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4">{log.reason ?? "-"}</td>
                      <td className="px-4 py-4">{log.ipAddress ?? "-"}</td>
                      <td className="max-w-60 px-4 py-4">{log.userAgent ?? "-"}</td>
                      <td className="max-w-80 px-4 py-4 font-mono text-xs">
                        {summarizeSnapshot(log.beforeSnapshot)}
                      </td>
                      <td className="max-w-80 px-4 py-4 font-mono text-xs">
                        {summarizeSnapshot(log.afterSnapshot)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
