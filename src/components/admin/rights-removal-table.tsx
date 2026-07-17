"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type {
  RightsRemovalRequestRecord,
  RightsRemovalStatus,
} from "@/server/compliance/rights-removal";
import type { AdminRole } from "@/server/auth/admin-access";

const statusLabels: Record<RightsRemovalStatus, string> = {
  received: "已受理",
  triaging: "核验中",
  awaiting_information: "等待补充",
  action_required: "待处理",
  resolved_removed: "已删除",
  resolved_rejected: "已驳回",
};

const triageTransitions: Record<
  RightsRemovalStatus,
  readonly RightsRemovalStatus[]
> = {
  received: ["triaging"],
  triaging: ["awaiting_information", "action_required"],
  awaiting_information: ["triaging", "action_required"],
  action_required: ["triaging"],
  resolved_removed: [],
  resolved_rejected: [],
};

function statusOptions(status: RightsRemovalStatus, role: AdminRole) {
  const options = [...triageTransitions[status]];
  if (role === "admin") {
    if (status === "triaging" || status === "awaiting_information") {
      options.push("resolved_rejected");
    }
    if (status === "action_required") {
      options.push("resolved_removed", "resolved_rejected");
    }
  }
  return options;
}

function safeExternalReference(reference: string) {
  try {
    const url = new URL(reference);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function RightsRemovalAction({
  request,
  actorRole,
}: {
  request: RightsRemovalRequestRecord;
  actorRole: AdminRole;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RightsRemovalStatus | "">("");
  const [reason, setReason] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFinal = status === "resolved_removed" || status === "resolved_rejected";
  const disabled =
    submitting ||
    !status ||
    reason.trim().length < 6 ||
    (isFinal && resolutionSummary.trim().length < 6);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/rights-removal/${request.id}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            reason,
            resolutionSummary: isFinal ? resolutionSummary : undefined,
          }),
        },
      );
      if (!response.ok) {
        setError("状态更新失败，请检查权限和状态后重试。");
        return;
      }
      router.refresh();
    } catch {
      setError("状态更新失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  const options = statusOptions(request.status, actorRole);
  if (options.length === 0) {
    return <span className="text-xs text-[var(--muted)]">已结案</span>;
  }

  return (
    <form className="min-w-56 space-y-2" onSubmit={submit}>
      <select
        aria-label={`${request.publicReference} 下一状态`}
        className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
        onChange={(event) => setStatus(event.target.value as RightsRemovalStatus)}
        value={status}
      >
        <option value="">选择下一状态</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {statusLabels[option]}
          </option>
        ))}
      </select>
      <input
        aria-label={`${request.publicReference} 操作原因`}
        className="h-10 w-full rounded-md border border-[var(--line)] px-3 text-sm"
        maxLength={500}
        onChange={(event) => setReason(event.target.value)}
        placeholder="操作原因，至少 6 个字符"
        value={reason}
      />
      {isFinal ? (
        <textarea
          aria-label={`${request.publicReference} 处理摘要`}
          className="min-h-20 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
          maxLength={2000}
          onChange={(event) => setResolutionSummary(event.target.value)}
          placeholder="最终处理摘要"
          value={resolutionSummary}
        />
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <button
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--ink)] px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        type="submit"
      >
        {submitting ? "更新中..." : "更新状态"}
      </button>
    </form>
  );
}

export function RightsRemovalTable({
  requests,
  actorRole,
}: {
  requests: RightsRemovalRequestRecord[];
  actorRole: AdminRole;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--line)] text-sm">
          <thead className="bg-[var(--surface)] text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">编号</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">权利类型</th>
              <th className="px-4 py-3 font-medium">举报邮箱</th>
              <th className="px-4 py-3 font-medium">内容引用</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {requests.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-[var(--muted)]" colSpan={7}>
                  当前没有待处理的权利通知。
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr className="align-top" key={request.id}>
                  <td className="px-4 py-4 font-medium">{request.publicReference}</td>
                  <td className="px-4 py-4">{statusLabels[request.status]}</td>
                  <td className="px-4 py-4">{request.rightsType}</td>
                  <td className="px-4 py-4">{request.reporterEmail}</td>
                  <td className="max-w-72 px-4 py-4">
                    <ul className="space-y-1 break-all">
                      {request.contentReferences.map((reference) => {
                        const href = safeExternalReference(reference);
                        return (
                          <li key={reference}>
                            {href ? (
                              <a
                                className="text-[var(--accent)] underline"
                                href={href}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {reference}
                              </a>
                            ) : (
                              reference
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-[var(--muted)]">
                    {new Date(request.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-4">
                    <RightsRemovalAction actorRole={actorRole} request={request} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
