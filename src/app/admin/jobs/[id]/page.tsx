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
            description="当任务无法恢复时，填写原因并释放冻结点数。"
            endpoint={`/api/admin/jobs/${detail.job.id}/undeliverable`}
            submitLabel="标记不可交付"
            title="释放任务"
          />
          <AdminActionForm
            description="手动补点用于赔付或运营补偿。这里需要输入目标用户和点数。"
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
