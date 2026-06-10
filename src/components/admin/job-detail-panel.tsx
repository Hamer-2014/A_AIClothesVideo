import type { getAdminJobDetail } from "@/server/admin/jobs";

interface AdminJobDetailPanelProps {
  detail: NonNullable<Awaited<ReturnType<typeof getAdminJobDetail>>>;
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
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

export function JobDetailPanel({ detail }: AdminJobDetailPanelProps) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Job
          </p>
          <p className="mt-3 text-sm font-medium">{detail.job.id}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{detail.job.status}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            User
          </p>
          <p className="mt-3 text-sm font-medium">{detail.job.userId}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {detail.job.isTest ? "测试任务" : "正式任务"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Spec
          </p>
          <p className="mt-3 text-sm font-medium">
            {detail.job.durationSeconds} 秒 / {detail.job.aspectRatio}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {detail.job.creditCost} 点
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Deliverable
          </p>
          <p className="mt-3 text-sm font-medium">
            {detail.job.finalVideoKey ?? "尚未生成"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {detail.job.failureReason ?? detail.job.userVisibleStatus}
          </p>
        </div>
      </section>

      <JsonBlock title="素材" data={detail.assets} />
      <JsonBlock title="素材识别" data={detail.analyses} />
      <JsonBlock title="最新分镜" data={detail.latestStoryboard} />
      <JsonBlock title="Segments" data={detail.segments} />
      <JsonBlock title="Moderation" data={detail.moderationResults} />
      <JsonBlock title="Provider Logs" data={detail.providerLogs} />
      <JsonBlock title="Stitch Jobs" data={detail.stitchJobs} />
      <JsonBlock title="Post-QA" data={detail.postQaResults} />
      <JsonBlock title="Credit Ledger" data={detail.ledger} />
      <JsonBlock title="State Events" data={detail.stateEvents} />
    </div>
  );
}
