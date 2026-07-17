import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { JobDetailPanel } from "@/components/admin/job-detail-panel";
import { getAdminSession } from "@/server/auth/admin-session";
import {
  createDrizzleAdminJobStore,
  getAdminJobDetail,
} from "@/server/admin/jobs";

export const dynamic = "force-dynamic";

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const { id } = await params;
  const detail = await getAdminJobDetail({
    store: createDrizzleAdminJobStore(),
    jobId: id,
  });

  if (!detail) {
    redirect("/admin/jobs");
  }

  const hasReserve = detail.ledger.some((entry) => entry.type === "reserve");
  const hasResolvedReserve = detail.ledger.some((entry) =>
    ["capture", "release", "refund"].includes(entry.type),
  );
  const hasAdminCompensation = detail.ledger.some(
    (entry) =>
      entry.type === "admin_adjust" &&
      entry.idempotencyKey === `admin_adjust:job:${detail.job.id}`,
  );
  const canReleaseCredits =
    detail.job.creditCost > 0 &&
    Boolean(detail.job.reservedLedgerId) &&
    hasReserve &&
    !hasResolvedReserve;
  const releaseDisabledReason = canReleaseCredits
    ? null
    : detail.job.creditCost <= 0
      ? "这条任务是免费试用或 0 点任务，没有冻结点数可释放。"
      : !detail.job.reservedLedgerId || !hasReserve
        ? "这条任务没有 reserve 冻结流水，不能执行释放冻结点数。"
        : "这条任务的冻结点数已经 capture、release 或 refund 处理过，不能重复释放。";
  const canCompensateCredits =
    detail.job.creditCost > 0 && !hasAdminCompensation;
  const compensationDisabledReason =
    detail.job.creditCost <= 0
      ? "这条任务没有实际扣点，默认不需要按任务补偿点数。"
      : hasAdminCompensation
        ? "这条任务已经执行过一次任务级补偿，不能重复补点。"
        : null;

  return (
    <AdminShell
      title={`任务详情 ${detail.job.id.slice(0, 8)}`}
      subtitle="这里保留后台真实状态和调用链路，供排障、补偿和复盘使用。"
      nav={buildAdminNav("/admin/jobs")}
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminActionForm
            description="仅用于已有拼接成片和 QA 抽帧、但 Post-QA 被错误打失败的任务。会重新进入 post_qa_queued。"
            endpoint={`/api/admin/jobs/${detail.job.id}/reopen-post-qa`}
            submitLabel="重开 Post-QA"
            title="重试质检"
          />
          <AdminActionForm
            description="仅用于已失败、仍有冻结流水且未 capture/refund/release 的任务。已交付、无冻结流水或已处理过的任务会被拒绝。"
            disabledReason={releaseDisabledReason}
            endpoint={`/api/admin/jobs/${detail.job.id}/release-credits`}
            submitLabel="释放冻结点数"
            title="释放冻结点数"
          />
          <AdminActionForm
            description="任务级补偿只用于付费任务赔付或运营补偿。补偿会关联当前任务并使用稳定幂等键，避免重复补点。"
            disabledReason={canCompensateCredits ? null : compensationDisabledReason}
            endpoint="/api/admin/credits/adjust"
            fields={[
              {
                name: "userId",
                label: "目标用户",
                defaultValue: detail.job.userId,
              },
              {
                name: "amount",
                label: "补点数量",
                type: "number",
                defaultValue: String(detail.job.creditCost),
              },
            ]}
            fixedPayload={{ relatedJobId: detail.job.id }}
            idempotencyKey={`admin_adjust:job:${detail.job.id}`}
            submitLabel="手动补点"
            title="补偿点数"
          />
        </div>

        {detail.segments.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {detail.segments.map((segment) => (
              <AdminActionForm
                description={`重试片段 ${segment.segmentIndex}，会把 segment 重新置回 queued。`}
                endpoint={`/api/admin/segments/${segment.id}/retry`}
                fixedPayload={{ jobId: detail.job.id }}
                key={segment.id}
                submitLabel="重试片段"
                title={`Segment ${segment.segmentIndex}`}
              />
            ))}
          </div>
        ) : null}

        <JobDetailPanel detail={detail} />
      </div>
    </AdminShell>
  );
}
