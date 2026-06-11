import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/shell";
import { AnalyzeRetryButton } from "@/components/jobs/analyze-retry-button";
import { JobDeliverablePanel } from "@/components/jobs/job-deliverable-panel";
import { JobContinuePanel } from "@/components/jobs/job-continue-panel";
import { JobProgress } from "@/components/jobs/job-progress";
import { buildDashboardNav } from "@/app/app-shell";
import { getServerSession } from "@/lib/auth/server";
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

export const dynamic = "force-dynamic";

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
  const [detail, progress] = await Promise.all([
    getVideoJobDetail({
      store: createDrizzleVideoJobReadStore(),
      jobId: id,
      userId,
      templates: mvpShotTemplates,
      isTrial: false,
    }),
    getVideoJobProgress({
      store: createDrizzleJobProgressStore(),
      jobId: id,
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

  return (
    <DashboardShell
      title={`任务 ${detail.job.id.slice(0, 8)}`}
      subtitle="这里展示用户可理解的真实进度、质检状态和成片下载入口。"
      nav={buildDashboardNav("/jobs")}
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
        <JobProgress progress={progress} />

        {progress.downloadReady ? (
          <JobDeliverablePanel
            defaultFilename={`runwaytools-${detail.job.id.slice(0, 8)}.mp4`}
            jobId={detail.job.id}
            previewUrl={previewUrl}
          />
        ) : null}

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
              {detail.job.failureReason || detail.job.lastError ? (
                <p className="mt-2 text-sm text-[var(--accent)]">
                  {detail.job.failureReason ?? detail.job.lastError}
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
          <h2 className="text-base font-medium">最新分镜</h2>
          {detail.latestStoryboard ? (
            <pre className="mt-4 overflow-x-auto rounded-md bg-[var(--surface)] p-4 text-xs leading-6 text-[var(--muted)]">
              {JSON.stringify(detail.latestStoryboard.storyboardJson, null, 2)}
            </pre>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">尚未生成分镜。</p>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
