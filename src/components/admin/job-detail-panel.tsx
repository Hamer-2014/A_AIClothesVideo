import type { getAdminJobDetail } from "@/server/admin/jobs";

import { JobDiagnosisPanel } from "./job-diagnosis-panel";
import { JobFailureSummary } from "./job-failure-summary";

interface AdminJobDetailPanelProps {
  detail: NonNullable<Awaited<ReturnType<typeof getAdminJobDetail>>>;
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN");
}

function stringifyJson(data: unknown) {
  return JSON.stringify(data, null, 2);
}

function JsonBlock({
  title,
  data,
}: {
  title: string;
  data: unknown;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <h3 className="text-base font-medium">{title}</h3>
      <pre className="mt-4 overflow-x-auto rounded-md bg-[var(--surface)] p-4 text-xs leading-6 text-[var(--muted)]">
        {stringifyJson(data)}
      </pre>
    </section>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6">{value}</p>
    </div>
  );
}

function SectionTable({
  title,
  columns,
  rows,
  emptyText,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-base font-medium">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--line)] text-sm">
          <thead className="bg-[var(--surface)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3 font-medium" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr className="align-top" key={`${title}-${index}`}>
                  {row.map((value, valueIndex) => (
                    <td className="px-4 py-4" key={`${title}-${index}-${valueIndex}`}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function JobDetailPanel({ detail }: AdminJobDetailPanelProps) {
  return (
    <div className="space-y-6">
      <JobDiagnosisPanel diagnosis={detail.diagnosis} />

      <JobFailureSummary
        job={{
          status: detail.job.status,
          userVisibleStatus: detail.job.userVisibleStatus,
          failureReason: detail.job.failureReason,
          lastError: detail.job.lastError,
          billingMode: detail.job.billingMode,
          creditCost: detail.job.creditCost,
          reservedLedgerId: detail.job.reservedLedgerId,
        }}
        segments={detail.segments}
        stitchJobs={detail.stitchJobs}
        postQaResults={detail.postQaResults}
      />

      <section className="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
        <SummaryItem label="任务状态" value={detail.job.status} />
        <SummaryItem label="用户可见状态" value={detail.job.userVisibleStatus} />
        <SummaryItem label="失败原因" value={detail.job.failureReason ?? "-"} />
        <SummaryItem label="最后错误" value={detail.job.lastError ?? "-"} />
        <SummaryItem label="任务类型" value={detail.job.isTest ? "测试任务" : "正式任务"} />
        <SummaryItem label="Preset" value={detail.job.presetId ?? "-"} />
        <SummaryItem
          label="规格"
          value={`${detail.job.durationSeconds} 秒 / ${detail.job.aspectRatio}`}
        />
        <SummaryItem label="点数成本" value={`${detail.job.creditCost} 点`} />
        <SummaryItem label="创建时间" value={formatDateTime(detail.job.createdAt)} />
        <SummaryItem label="更新时间" value={formatDateTime(detail.job.updatedAt)} />
        <SummaryItem label="Final Video Key" value={detail.job.finalVideoKey ?? "-"} />
        <SummaryItem label="Cover Key" value={detail.job.coverKey ?? "-"} />
        <SummaryItem label="保留流水" value={detail.job.reservedLedgerId ?? "-"} />
      </section>

      <SectionTable
        title="素材区"
        columns={["Asset", "角色", "原始 Key", "检测角色", "文件名"]}
        emptyText="当前任务没有关联素材。"
        rows={detail.assets.map((asset) => [
          asset.assetId,
          asset.role,
          asset.originalKey ?? "-",
          asset.detectedRole ?? "-",
          asset.fileName ?? "-",
        ])}
      />

      <JsonBlock
        title="Trial Eligibility"
        data={detail.job.trialEligibilitySnapshot ?? null}
      />

      <JsonBlock
        title="Style Preset Snapshot"
        data={detail.job.presetSnapshot ?? detail.latestStoryboard?.presetSnapshot ?? null}
      />

      <SectionTable
        title="素材分析"
        columns={["Asset", "Mode", "结果摘要"]}
        emptyText="当前没有素材分析记录。"
        rows={detail.analyses.map((analysis) => [
          analysis.assetId,
          analysis.mode ?? "-",
          stringifyJson(analysis.analysisJson),
        ])}
      />

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">分镜区</h3>
        {detail.latestStoryboard ? (
          <div className="mt-4 space-y-4 text-sm">
            <div className="grid gap-3 lg:grid-cols-3">
              <SummaryItem label="分镜状态" value={detail.latestStoryboard.status} />
              <SummaryItem
                label="Preset"
                value={detail.latestStoryboard.presetId ?? detail.job.presetId ?? "-"}
              />
              <SummaryItem
                label="模板 ID"
                value={stringifyJson(detail.latestStoryboard.selectedTemplateIds)}
              />
              <SummaryItem
                label="创建时间"
                value={formatDateTime(detail.latestStoryboard.createdAt)}
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  Storyboard JSON
                </p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--surface)] p-4 text-xs leading-6 text-[var(--muted)]">
                  {stringifyJson(detail.latestStoryboard.storyboardJson)}
                </pre>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  Final Prompt Snapshot
                </p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--surface)] p-4 text-xs leading-6 text-[var(--muted)]">
                  {stringifyJson(detail.latestStoryboard.finalPromptSnapshot ?? null)}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">当前没有分镜记录。</p>
        )}
      </section>

      <SectionTable
        title="Segment 表"
        columns={[
          "Index",
          "状态",
          "Template",
          "Provider",
          "Model",
          "Provider Task ID",
          "Video Key",
          "最后错误",
          "重试次数",
        ]}
        emptyText="当前没有 segment 记录。"
        rows={detail.segments.map((segment) => [
          String(segment.segmentIndex),
          segment.status,
          segment.templateId,
          segment.provider ?? "-",
          segment.model ?? "-",
          segment.providerTaskId ?? "-",
          segment.videoKey ?? "-",
          segment.lastError ?? "-",
          String(segment.attemptCount),
        ])}
      />

      <SectionTable
        title="Stitch 区"
        columns={["Stitch Job", "状态", "Segment Keys", "Final Video", "Cover", "Frame Keys", "最后错误"]}
        emptyText="当前没有 stitch 记录。"
        rows={detail.stitchJobs.map((stitchJob) => [
          stitchJob.id,
          stitchJob.status,
          stringifyJson(stitchJob.segmentKeys),
          stitchJob.finalVideoKey ?? "-",
          stitchJob.coverKey ?? "-",
          stringifyJson(stitchJob.frameKeys),
          stitchJob.lastError ?? "-",
        ])}
      />

      <SectionTable
        title="Post-QA 区"
        columns={["Post-QA", "状态", "Mode", "Failure Category", "Frame Keys", "结果", "创建时间"]}
        emptyText="当前没有 Post-QA 记录。"
        rows={detail.postQaResults.map((result) => [
          result.id,
          result.status,
          result.mode,
          result.failureCategory ?? "-",
          stringifyJson(result.frameKeys),
          stringifyJson(result.resultJson),
          formatDateTime(result.createdAt),
        ])}
      />

      <SectionTable
        title="Provider Logs 表"
        columns={[
          "Purpose",
          "Provider",
          "Model",
          "状态",
          "耗时",
          "成本",
          "Fallback",
          "Response Summary",
          "Route Snapshot",
        ]}
        emptyText="当前没有 provider call logs。"
        rows={detail.providerLogs.map((log) => [
          log.purpose,
          log.provider,
          log.model,
          log.status,
          log.durationMs ? `${log.durationMs} ms` : "-",
          log.costEstimate ?? "-",
          log.fallbackReason ?? "-",
          stringifyJson(log.responseSummary),
          stringifyJson(log.routeSnapshot ?? null),
        ])}
      />

      <SectionTable
        title="Moderation Results"
        columns={["Source", "Decision", "Provider", "Error Code", "Error Message", "创建时间"]}
        emptyText="当前没有 moderation 记录。"
        rows={detail.moderationResults.map((result) => [
          result.source,
          result.decision,
          result.provider ?? "-",
          result.errorCode ?? "-",
          result.errorMessage ?? "-",
          formatDateTime(result.createdAt),
        ])}
      />

      <SectionTable
        title="Credit Ledger"
        columns={["Type", "Amount", "Before", "After", "Reason", "Idempotency Key", "创建时间"]}
        emptyText="当前没有点数流水。"
        rows={detail.ledger.map((entry) => [
          entry.type,
          String(entry.amount),
          String(entry.balanceBefore),
          String(entry.balanceAfter),
          entry.reason,
          entry.idempotencyKey,
          formatDateTime(entry.createdAt),
        ])}
      />

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">State Events Timeline</h3>
        <div className="mt-4 space-y-3">
          {detail.stateEvents.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">当前没有状态事件。</p>
          ) : (
            detail.stateEvents.map((event) => (
              <div
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
                key={event.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium">
                    {event.fromStatus ?? "null"} → {event.toStatus}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {event.reason ?? "无 reason"} · {event.actorType} / {event.actorId ?? "-"}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <JsonBlock
        title="原始辅助数据"
        data={{
          storyboard: detail.latestStoryboard,
          segments: detail.segments,
          providerLogs: detail.providerLogs,
          moderationResults: detail.moderationResults,
          stitchJobs: detail.stitchJobs,
          postQaResults: detail.postQaResults,
          stateEvents: detail.stateEvents,
        }}
      />
    </div>
  );
}
