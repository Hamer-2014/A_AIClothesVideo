import { redirect } from "next/navigation";
import Image from "next/image";
import { ExternalLink, ImageOff } from "lucide-react";

import { DashboardShell } from "@/components/dashboard/shell";
import { AnalyzeRetryButton } from "@/components/jobs/analyze-retry-button";
import { JobContinuePanel } from "@/components/jobs/job-continue-panel";
import { JobLivePanels } from "@/components/jobs/job-live-panels";
import { buildDashboardNav } from "@/app/app-shell";
import { getServerSession } from "@/lib/auth/server";
import { userFacingJobMessage } from "@/lib/jobs/user-facing-message";
import { createPublicJobVideoUrl } from "@/server/files/job-download";
import { getJobSourceAssets } from "@/server/files/job-source-assets";
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

const sourceAssetRoleLabels: Record<string, string> = {
  front: "正面",
  back: "背面",
  side: "侧面",
  detail: "细节",
  scene: "场景",
  logo: "Logo",
  unknown: "素材",
};

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
  const [detail, progress, overview, sourceAssets] = await Promise.all([
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
    getJobSourceAssets({
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
          <div>
            <h2 className="text-base font-medium">原始素材</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              页面每次打开都会为当前账号重新生成临时访问地址，不会公开原始 R2 文件。
            </p>
          </div>
          {sourceAssets.length > 0 ? (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sourceAssets.map((asset) => (
                <li
                  className="min-w-0 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]"
                  key={asset.assetId}
                >
                  {asset.previewUrl ? (
                    <a
                      aria-label={`打开${sourceAssetRoleLabels[asset.role] ?? "素材"}原图`}
                      className="block aspect-[4/5] overflow-hidden bg-[var(--surface-subtle)]"
                      href={asset.previewUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Image
                        alt={`${sourceAssetRoleLabels[asset.role] ?? "素材"}：${asset.fileName}`}
                        className="size-full object-contain"
                        height={640}
                        src={asset.previewUrl}
                        unoptimized
                        width={512}
                      />
                    </a>
                  ) : (
                    <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 bg-[var(--surface-subtle)] px-4 text-center text-xs text-[var(--muted)]">
                      <ImageOff aria-hidden="true" size={20} />
                      素材暂不可预览
                    </div>
                  )}
                  <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {sourceAssetRoleLabels[asset.role] ?? "素材"}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {asset.fileName}
                      </p>
                    </div>
                    {asset.previewUrl ? (
                      <a
                        className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--action)] hover:underline"
                        href={asset.previewUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink aria-hidden="true" size={14} />
                        打开原图
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-[var(--muted)]">
                        暂不可用
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">当前任务没有可用素材。</p>
          )}
        </section>

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
