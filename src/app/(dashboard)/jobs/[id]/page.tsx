import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/shell";
import { AnalyzeRetryButton } from "@/components/jobs/analyze-retry-button";
import { JobContinuePanel } from "@/components/jobs/job-continue-panel";
import { JobLivePanels } from "@/components/jobs/job-live-panels";
import { buildDashboardNav } from "@/app/app-shell";
import { getServerSession } from "@/lib/auth/server";
import { userFacingJobMessage } from "@/lib/jobs/user-facing-message";
import { createPublicJobVideoUrl } from "@/server/files/job-download";
import {
  createDrizzleVideoJobReadStore,
  getVideoJobDetail,
} from "@/server/jobs/get-job";
import {
  createDrizzleJobProgressStore,
  getVideoJobProgress,
} from "@/server/jobs/progress";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import {
  createDrizzleUserBillingStore,
  getUserBillingOverview,
} from "@/server/billing/user-billing";

export const dynamic = "force-dynamic";

function storyboardSegments(storyboardJson: unknown) {
  if (
    !storyboardJson ||
    typeof storyboardJson !== "object" ||
    !("segments" in storyboardJson) ||
    !Array.isArray((storyboardJson as { segments?: unknown }).segments)
  ) {
    return [];
  }

  return (storyboardJson as {
    segments: Array<{
      index?: number;
      duration_seconds?: number;
      template_id?: string;
    }>;
  }).segments;
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { id } = await params;
  const [detail, progress, overview] = await Promise.all([
    getVideoJobDetail({
      store: createDrizzleVideoJobReadStore(),
      jobId: id,
      userId,
      templates: mvpShotTemplates,
    }),
    getVideoJobProgress({
      store: createDrizzleJobProgressStore(),
      jobId: id,
      userId,
    }),
    getUserBillingOverview({
      store: createDrizzleUserBillingStore(),
      userId,
    }),
  ]);

  if (!detail || !progress) {
    redirect("/jobs");
  }

  const previewUrl = createPublicJobVideoUrl({
    key: progress.finalVideoKey,
  });
  const canRetryAnalyze =
    detail.job.status === "asset_analysis_failed" ||
    detail.job.status === "asset_analysis_queued";
  const jobFailed = progress.phase === "failed" || progress.segmentProgress.failed > 0;
  const jobInfoMessage = jobFailed
    ? userFacingJobMessage(detail.job.failureReason ?? detail.job.lastError)
    : null;

  return (
    <DashboardShell
      title={`任务 ${detail.job.id.slice(0, 8)}`}
      subtitle="这里展示用户可理解的真实进度、质检状态和成片下载入口。"
      nav={buildDashboardNav("/jobs")}
      user={session.user}
      billing={overview.wallet}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {canRetryAnalyze ? (
            <AnalyzeRetryButton
              durationSeconds={detail.job.durationSeconds}
              jobId={detail.job.id}
            />
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        <JobLivePanels
          defaultFilename={`ai-clothes-video-${detail.job.id.slice(0, 8)}.mp4`}
          initialPreviewUrl={previewUrl}
          initialProgress={progress}
          jobId={detail.job.id}
          publicVideoBaseUrl={process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL}
        />

        <JobContinuePanel
          job={detail.job}
          latestStoryboard={
            detail.latestStoryboard
              ? {
                  id: detail.latestStoryboard.id,
                  status: detail.latestStoryboard.status,
                  storyboardJson: detail.latestStoryboard.storyboardJson as {
                    duration_seconds: number;
                    segments: Array<{
                      index: number;
                      duration_seconds: number;
                      template_id: string;
                      prompt: string;
                    }>;
                  },
                  selectedTemplateIds: Array.isArray(
                    detail.latestStoryboard.selectedTemplateIds,
                  )
                    ? detail.latestStoryboard.selectedTemplateIds.filter(
                        (item): item is string => typeof item === "string",
                      )
                    : [],
                }
              : null
          }
          recommendations={detail.recommendations}
          templateCatalog={mvpShotTemplates}
        />

        <section className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">任务信息</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Status
              </p>
              <p className="mt-2 text-sm">{detail.job.userVisibleStatus}</p>
              {jobInfoMessage ? (
                <p className="mt-2 text-sm text-[var(--accent)]">
                  {jobInfoMessage}
                </p>
              ) : null}
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Spec
              </p>
              <p className="mt-2 text-sm">
                {detail.job.durationSeconds} 秒 / {detail.job.aspectRatio}
              </p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Credits
              </p>
              <p className="mt-2 text-sm">{detail.job.creditCost} 点</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">分镜摘要</h2>
          {detail.latestStoryboard ? (
            <div className="mt-4 space-y-3">
              {storyboardSegments(detail.latestStoryboard.storyboardJson).map(
                (segment, index) => (
                  <div
                    className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
                    key={`${segment.template_id ?? "segment"}-${index}`}
                  >
                    <p className="text-sm font-medium">
                      镜头 {segment.index ?? index + 1}
                      {segment.duration_seconds
                        ? ` · ${segment.duration_seconds} 秒`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      模板：{segment.template_id ?? "系统推荐模板"}
                    </p>
                  </div>
                ),
              )}
              {storyboardSegments(detail.latestStoryboard.storyboardJson).length ===
              0 ? (
                <p className="text-sm text-[var(--muted)]">
                  分镜已生成，暂无可展示摘要。
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">尚未生成分镜。</p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
