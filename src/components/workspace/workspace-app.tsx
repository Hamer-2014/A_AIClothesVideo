"use client";

import { useMemo, useState } from "react";

import { SpecSelector } from "./spec-selector";
import {
  TemplatePicker,
  type TemplateAvailabilityCard,
} from "./template-picker";
import {
  StoryboardConfirmation,
} from "./storyboard-confirmation";
import { UploadPanel, type UploadedAssetItem } from "./upload-panel";

interface TemplateCatalogItem {
  templateId: string;
  displayName: string;
  description: string;
  riskLevel: string;
}

interface WorkspaceAppProps {
  templateCatalog: TemplateCatalogItem[];
}

interface JobDetailResponse {
  job: {
    id: string;
    status: string;
    userVisibleStatus: string;
    lastError?: string | null;
    failureReason?: string | null;
    durationSeconds: number;
    aspectRatio: string;
    creditCost: number;
  };
  assetCount: number;
  acceptable: boolean;
  assetCompleteness: {
    hasFront: boolean;
    hasBack: boolean;
    hasSide: boolean;
    hasDetail: boolean;
    hasScene: boolean;
    hasModelFront: boolean;
    hasFlatLayOrWhiteBackground: boolean;
    detailTypes: string[];
  };
  recommendations: {
    recommended: Array<{
      templateId: string;
      riskLevel: string;
      riskWarnings: string[];
    }>;
    optional: Array<{
      templateId: string;
      riskLevel: string;
      riskWarnings: string[];
    }>;
    unavailable: Array<{
      templateId: string;
      reasons: string[];
    }>;
    availableTemplateIds: string[];
  };
  latestStoryboard: {
    id: string;
    status: string;
    storyboardJson: {
      duration_seconds: number;
      segments: Array<{
        index: number;
        duration_seconds: number;
        template_id: string;
        prompt: string;
      }>;
    };
  } | null;
}

function reasonLabel(reason: string) {
  switch (reason) {
    case "back_asset_required":
      return "缺少背面图";
    case "detail_asset_required":
      return "缺少细节图";
    case "fabric_detail_required":
      return "缺少面料细节图";
    case "neckline_detail_required":
      return "缺少领口图";
    case "cuff_detail_required":
      return "缺少袖口图";
    case "print_detail_required":
      return "缺少印花细节图";
    case "trial_requires_low_risk_template":
      return "试用版仅开放低风险模板";
    case "flat_lay_or_white_background_required":
      return "缺少白底/平铺素材";
    case "model_front_asset_required":
      return "缺少模特正面图";
    default:
      return reason;
  }
}

function warningLabel(warning: string) {
  switch (warning) {
    case "high_risk_motion":
      return "高风险镜头";
    case "strict_review_required":
      return "需严格质检";
    default:
      return warning;
  }
}

export function WorkspaceApp({ templateCatalog }: WorkspaceAppProps) {
  const [assets, setAssets] = useState<UploadedAssetItem[]>([]);
  const [durationSeconds, setDurationSeconds] = useState<8 | 16 | 24>(8);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetailResponse | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [userPrompt, setUserPrompt] = useState("保持服装版型稳定，适合商品页宣传。");
  const [storyboardId, setStoryboardId] = useState<string | null>(null);
  const [segments, setSegments] = useState<
    Array<{ index: number; durationSeconds: number; templateId: string; prompt: string }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const requiredTemplateCount = durationSeconds === 8 ? 1 : durationSeconds === 16 ? 2 : 3;

  async function loadJobDetail(nextJobId: string, nextDurationSeconds: 8 | 16 | 24) {
    const detailResponse = await fetch(
      `/api/jobs/${nextJobId}?trial=${nextDurationSeconds === 8 ? "true" : "false"}`,
    );
    const detailBody = await detailResponse.json();

    if (!detailResponse.ok) {
      setMessage("读取任务详情失败。");
      return null;
    }

    setJobDetail(detailBody);
    setSelectedTemplateIds(
      detailBody.recommendations.availableTemplateIds.slice(0, requiredTemplateCount),
    );
    setMessage(
      detailBody.job.failureReason ??
        detailBody.job.lastError ??
        "素材分析完成，请确认模板。",
    );

    return detailBody as JobDetailResponse;
  }

  async function runAnalyzeJob(nextJobId: string, nextDurationSeconds: 8 | 16 | 24) {
    const analyzeResponse = await fetch(`/api/jobs/${nextJobId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: nextDurationSeconds === 8 ? "lite" : "standard",
        isTrial: nextDurationSeconds === 8,
      }),
    });

    if (!analyzeResponse.ok) {
      const body = (await analyzeResponse.json().catch(() => null)) as
        | { message?: string | null }
        | null;
      setMessage(body?.message ?? "素材分析失败，请稍后重试。");
      return null;
    }

    return loadJobDetail(nextJobId, nextDurationSeconds);
  }

  const templateCards = useMemo(() => {
    if (!jobDetail) {
      return {
        recommended: [] as TemplateAvailabilityCard[],
        optional: [] as TemplateAvailabilityCard[],
        unavailable: [] as TemplateAvailabilityCard[],
      };
    }

    const byId = new Map(templateCatalog.map((item) => [item.templateId, item]));

    return {
      recommended: jobDetail.recommendations.recommended.map((item) => ({
        templateId: item.templateId,
        displayName: byId.get(item.templateId)?.displayName ?? item.templateId,
        description: byId.get(item.templateId)?.description ?? "",
        riskLevel: item.riskLevel,
        selectable: true,
        selected: selectedTemplateIds.includes(item.templateId),
        warnings: item.riskWarnings.map(warningLabel),
      })),
      optional: jobDetail.recommendations.optional.map((item) => ({
        templateId: item.templateId,
        displayName: byId.get(item.templateId)?.displayName ?? item.templateId,
        description: byId.get(item.templateId)?.description ?? "",
        riskLevel: item.riskLevel,
        selectable: true,
        selected: selectedTemplateIds.includes(item.templateId),
        warnings: item.riskWarnings.map(warningLabel),
      })),
      unavailable: jobDetail.recommendations.unavailable.map((item) => ({
        templateId: item.templateId,
        displayName: byId.get(item.templateId)?.displayName ?? item.templateId,
        description: byId.get(item.templateId)?.description ?? "",
        riskLevel: byId.get(item.templateId)?.riskLevel ?? "unknown",
        selectable: false,
        selected: false,
        reasons: item.reasons.map(reasonLabel),
      })),
    };
  }, [jobDetail, selectedTemplateIds, templateCatalog]);

  function addUploadedAsset(asset: UploadedAssetItem) {
    setAssets((current) => [...current, asset]);
  }

  async function createJob() {
    const uploadedAssetIds = assets
      .filter((asset) => asset.status === "uploaded")
      .map((asset) => asset.assetId);

    if (uploadedAssetIds.length === 0) {
      setMessage("请先上传至少一张素材图。");
      return;
    }

    setBusyAction("create-job");
    setMessage(null);
    setJobDetail(null);
    setStoryboardId(null);
    setSegments([]);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetIds: uploadedAssetIds,
        durationSeconds,
        aspectRatio,
        isTrial: durationSeconds === 8,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setMessage("创建任务失败，请检查素材和规格。");
      setBusyAction(null);
      return;
    }

    setJobId(body.jobId);
    setBusyAction("analyze");
    setMessage("任务已创建，正在自动分析素材...");

    const detail = await runAnalyzeJob(body.jobId, durationSeconds);
    if (!detail) {
      setBusyAction(null);
      return;
    }

    setBusyAction(null);
  }

  async function analyzeJob() {
    if (!jobId) {
      return;
    }

    setBusyAction("analyze");
    await runAnalyzeJob(jobId, durationSeconds);
    setBusyAction(null);
  }

  function toggleTemplate(templateId: string) {
    setSelectedTemplateIds((current) => {
      if (current.includes(templateId)) {
        return current.filter((item) => item !== templateId);
      }

      if (current.length >= requiredTemplateCount) {
        return [...current.slice(1), templateId];
      }

      return [...current, templateId];
    });
  }

  async function generateStoryboard() {
    if (!jobId || selectedTemplateIds.length !== requiredTemplateCount) {
      setMessage(`请选择 ${requiredTemplateCount} 个模板后再生成分镜。`);
      return;
    }

    setBusyAction("storyboard");
    const response = await fetch(`/api/jobs/${jobId}/storyboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedTemplateIds,
        userPrompt,
        isTrial: durationSeconds === 8,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setMessage(
        body.error === "prompt_moderation_unavailable"
          ? "审核服务暂时不可用，请稍后再试。"
          : body.error === "prompt_moderation_blocked"
            ? "提示词未通过审核。"
            : "分镜生成失败。",
      );
      setBusyAction(null);
      return;
    }

    setStoryboardId(body.storyboardId);
    setSegments(body.segments);
    setMessage("分镜草稿已生成，请确认。");
    setBusyAction(null);
  }

  async function confirmStoryboard() {
    if (!jobId || !storyboardId) {
      return;
    }

    setBusyAction("confirm");
    const response = await fetch(`/api/jobs/${jobId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyboardId,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setMessage(
        body.error === "prompt_moderation_unavailable"
          ? "审核服务暂时不可用，请稍后再试。"
          : body.error === "prompt_moderation_blocked"
            ? "最终视频提示词未通过审核。"
            : body.error === "insufficient_credits"
              ? "点数不足，请先充值。"
              : body.error === "storyboard_not_confirmable"
                ? "这个分镜已经不能重复确认，请打开任务详情查看当前进度。"
              : "确认分镜失败。",
      );
      setBusyAction(null);
      return;
    }

    window.location.href = `/jobs/${body.jobId}`;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <section className="space-y-6">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">上传与任务创建</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            先上传素材，再确认规格并创建完整视频任务。
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <UploadPanel assets={assets} onUploaded={addUploadedAsset} />
            <div className="space-y-5">
              <SpecSelector
                aspectRatio={aspectRatio}
                durationSeconds={durationSeconds}
                onAspectRatioChange={setAspectRatio}
                onDurationChange={setDurationSeconds}
              />
              <button
                className="inline-flex h-11 items-center rounded-md bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busyAction !== null}
                onClick={createJob}
                type="button"
              >
                {busyAction === "create-job" ? "创建中..." : "创建任务"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-medium">素材分析与模板选择</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                系统会根据素材完整度给出推荐、可选和不可用模板。
              </p>
            </div>
            <button
              className="inline-flex h-10 items-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!jobId || busyAction !== null}
              onClick={analyzeJob}
              type="button"
            >
              {busyAction === "analyze" ? "分析中..." : "重新分析素材"}
            </button>
          </div>
          {jobDetail ? (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Front
                  </p>
                  <p className="mt-2 text-sm">
                    {jobDetail.assetCompleteness.hasFront ? "有" : "无"}
                  </p>
                </div>
                <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Back
                  </p>
                  <p className="mt-2 text-sm">
                    {jobDetail.assetCompleteness.hasBack ? "有" : "无"}
                  </p>
                </div>
                <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Detail
                  </p>
                  <p className="mt-2 text-sm">
                    {jobDetail.assetCompleteness.hasDetail
                      ? jobDetail.assetCompleteness.detailTypes.join(" / ") || "有"
                      : "无"}
                  </p>
                </div>
              </div>
              <TemplatePicker
                onToggle={toggleTemplate}
                optional={templateCards.optional}
                recommended={templateCards.recommended}
                unavailable={templateCards.unavailable}
              />
            </div>
          ) : (
            <p className="mt-5 text-sm text-[var(--muted)]">
              创建任务后会自动分析素材，失败时可在这里重试。
            </p>
          )}
        </div>
      </section>

      <aside className="space-y-6">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">生成意图</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            输入卖点、场景或风格偏好。所有文本都会先经过 Creem Moderation。
          </p>
          <textarea
            className="mt-4 min-h-40 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => setUserPrompt(event.target.value)}
            value={userPrompt}
          />
          <button
            className="mt-4 inline-flex h-11 items-center rounded-md border border-[var(--line)] bg-white px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!jobDetail || busyAction !== null}
            onClick={generateStoryboard}
            type="button"
          >
            {busyAction === "storyboard" ? "生成中..." : "生成分镜草稿"}
          </button>
        </div>

        <StoryboardConfirmation
          aspectRatio={aspectRatio}
          creditCost={jobDetail?.job.creditCost ?? 0}
          disabled={!storyboardId || busyAction !== null}
          durationSeconds={durationSeconds}
          moderationPendingMessage={
            durationSeconds === 8
              ? "免费试用默认使用低风险模板与 lite 质检。"
              : "确认后先审核，再冻结点数并进入片段生成。"
          }
          onConfirm={confirmStoryboard}
          segments={segments}
        />

        {message ? (
          <div className="rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
            {message}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
