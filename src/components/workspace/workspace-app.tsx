"use client";

import { useEffect, useMemo, useState } from "react";

import { SpecSelector } from "./spec-selector";
import { TrialStatusPanel } from "./trial-status-panel";
import {
  TemplatePicker,
  type TemplateAvailabilityCard,
} from "./template-picker";
import {
  StoryboardConfirmation,
} from "./storyboard-confirmation";
import { UploadPanel, type UploadedAssetItem } from "./upload-panel";
import { getOrCreateDeviceFingerprint } from "@/lib/abuse/device-fingerprint";
import {
  getStylePreset,
  selectTemplateIdsForPreset,
  type StylePresetId,
  type WorkspaceEntryMode,
} from "@/lib/presets";
import {
  WORKSPACE_GUEST_DRAFT_KEY,
  parseWorkspaceGuestDraft,
  serializeWorkspaceGuestDraft,
} from "@/lib/workspace/guest-draft";
import type { TrialStatus } from "@/server/trial/status";

import { StylePresetSelector } from "./style-preset-selector";

interface TemplateCatalogItem {
  templateId: string;
  displayName: string;
  description: string;
  riskLevel: string;
  requiredAssets?: string[];
  detailTypes?: string[];
}

interface WorkspaceAppProps {
  templateCatalog: TemplateCatalogItem[];
  initialMode?: WorkspaceEntryMode;
  initialPresetId?: string | null;
  isAuthenticated?: boolean;
  loginHref?: string;
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
    presetId?: string | null;
    presetSnapshot?: unknown;
    creditCost: number;
    billingMode: "free_trial" | "paid";
    generationProfile: string;
    watermarkEnabled: boolean;
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
  analyses: Array<{
    assetId: string;
    declaredRole?: string;
    assetRole: string;
    quality: {
      isGarment: boolean;
      isClear: boolean;
      isSafe: boolean;
      hasFlatLayOrWhiteBackground?: boolean;
    };
    confidence: string;
    riskFlags: string[];
  }>;
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

function paidCreditCost(durationSeconds: 8 | 16 | 24) {
  switch (durationSeconds) {
    case 8:
      return 70;
    case 16:
      return 130;
    case 24:
      return 190;
  }
}

function hasRequiredIntent(
  requiredAsset: string,
  uploadedRoles: Set<string>,
) {
  switch (requiredAsset) {
    case "front":
    case "back":
    case "side":
    case "detail":
    case "scene":
      return uploadedRoles.has(requiredAsset);
    case "model_front":
    case "flat_lay_or_white_background":
      return uploadedRoles.has("front");
    default:
      return false;
  }
}

function missingIntentReason(requiredAsset: string) {
  switch (requiredAsset) {
    case "front":
      return "缺少正面图";
    case "back":
      return "缺少背面图";
    case "side":
      return "缺少侧面图";
    case "detail":
      return "缺少细节图";
    case "scene":
      return "缺少场景图";
    case "model_front":
      return "缺少模特正面图";
    case "flat_lay_or_white_background":
      return "需分析确认白底/平铺素材";
    default:
      return "素材不足";
  }
}

export function WorkspaceApp({
  templateCatalog,
  initialMode = "paid",
  initialPresetId,
  isAuthenticated = true,
  loginHref = "/login?next=%2Fworkspace%3FresumeDraft%3D1",
}: WorkspaceAppProps) {
  const initialPreset = getStylePreset(initialPresetId);
  const [assets, setAssets] = useState<UploadedAssetItem[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<StylePresetId>(
    initialPreset.id,
  );
  const [durationSeconds, setDurationSeconds] = useState<8 | 16 | 24>(
    initialMode === "trial" ? 8 : initialPreset.defaultDurationSeconds,
  );
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">(
    initialPreset.defaultAspectRatio,
  );
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetailResponse | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [userPrompt, setUserPrompt] = useState(initialPreset.defaultIntent);
  const [storyboardId, setStoryboardId] = useState<string | null>(null);
  const [segments, setSegments] = useState<
    Array<{ index: number; durationSeconds: number; templateId: string; prompt: string }>
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);

  useEffect(() => {
    if (!isAuthenticated || initialMode !== "trial") {
      return;
    }

    const deviceFingerprint = getOrCreateDeviceFingerprint();
    const trialStatusUrl = deviceFingerprint
      ? `/api/trial/status?deviceFingerprint=${encodeURIComponent(
          deviceFingerprint,
        )}`
      : "/api/trial/status";

    void fetch(trialStatusUrl)
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        setTrialStatus((await response.json()) as TrialStatus);
      })
      .catch(() => undefined);
  }, [initialMode, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const draft = parseWorkspaceGuestDraft(
      window.sessionStorage.getItem(WORKSPACE_GUEST_DRAFT_KEY),
    );
    if (!draft) {
      return;
    }

    let cancelled = false;
    const restoreDraft = () => {
      if (cancelled) {
        return;
      }

      setSelectedPresetId(draft.presetId);
      setDurationSeconds(draft.durationSeconds);
      setAspectRatio(draft.aspectRatio);
      setUserPrompt(draft.userPrompt);
      setMessage("已恢复刚才的配置，请重新选择图片后生成。");
      window.sessionStorage.removeItem(WORKSPACE_GUEST_DRAFT_KEY);
    };

    window.queueMicrotask(restoreDraft);

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const requiredTemplateCount = durationSeconds === 8 ? 1 : durationSeconds === 16 ? 2 : 3;
  const paidCost = paidCreditCost(durationSeconds);
  const previewableAssetStatuses = useMemo(
    () =>
      isAuthenticated
        ? new Set<UploadedAssetItem["status"]>(["uploaded"])
        : new Set<UploadedAssetItem["status"]>(["uploaded", "local"]),
    [isAuthenticated],
  );
  const hasPreviewableAssets = assets.some((asset) =>
    previewableAssetStatuses.has(asset.status),
  );
  const canUseFreeTrial =
    durationSeconds === 8 &&
    (!trialStatus || trialStatus.state === "available");
  const showAdvancedManualControls =
    advancedOpen || Boolean(storyboardId) || segments.length > 0;
  const uploadedRoles = useMemo(
    () =>
      new Set(
        assets
          .filter((asset) => previewableAssetStatuses.has(asset.status))
          .map((asset) => asset.intendedRole),
      ),
    [assets, previewableAssetStatuses],
  );
  const materialWarnings = useMemo(() => {
    if (!jobDetail) {
      return [];
    }

    const garmentRoles = new Set(["front", "back", "side", "detail", "unknown"]);
    return (jobDetail.analyses ?? [])
      .filter((analysis) => {
        const effectiveRole = analysis.declaredRole ?? analysis.assetRole;
        return (
          garmentRoles.has(effectiveRole) &&
          (effectiveRole === "unknown" ||
            !analysis.quality.isGarment ||
            !analysis.quality.isClear)
        );
      })
      .map((analysis) =>
        !analysis.quality.isGarment
          ? "有素材不像服装图，相关模板会被降级。"
          : !analysis.quality.isClear
            ? "有素材清晰度不足，生成前建议替换。"
            : "有素材角色无法确认，生成前会按低置信处理。",
      );
  }, [jobDetail]);

  function requiredTemplateCountForDuration(value: 8 | 16 | 24) {
    return value === 8 ? 1 : value === 16 ? 2 : 3;
  }

  function defaultTemplateSelection(
    detailBody: JobDetailResponse,
    nextDurationSeconds: 8 | 16 | 24,
  ) {
    return selectTemplateIdsForPreset({
      recommendations: detailBody.recommendations,
      preset: getStylePreset(selectedPresetId),
      durationSeconds: nextDurationSeconds,
    });
  }

  function changePreset(presetId: StylePresetId) {
    const nextPreset = getStylePreset(presetId);
    setSelectedPresetId(nextPreset.id);
    setUserPrompt(nextPreset.defaultIntent);
    setAspectRatio(nextPreset.defaultAspectRatio);
    if (!nextPreset.allowedDurationSeconds.includes(durationSeconds)) {
      setDurationSeconds(nextPreset.defaultDurationSeconds);
    }
  }

  async function loadJobDetail(nextJobId: string, nextDurationSeconds: 8 | 16 | 24) {
    const detailResponse = await fetch(`/api/jobs/${nextJobId}`);
    const detailBody = await detailResponse.json();

    if (!detailResponse.ok) {
      setMessage("读取任务详情失败。");
      return null;
    }

    const typedDetailBody = detailBody as JobDetailResponse;

    setJobDetail(typedDetailBody);
    setSelectedTemplateIds(defaultTemplateSelection(
      typedDetailBody,
      nextDurationSeconds,
    ));
    if (typedDetailBody.latestStoryboard?.status === "draft") {
      setStoryboardId(typedDetailBody.latestStoryboard.id);
      setSegments(
        typedDetailBody.latestStoryboard.storyboardJson.segments.map((segment) => ({
          index: segment.index,
          durationSeconds: segment.duration_seconds,
          templateId: segment.template_id,
          prompt: segment.prompt,
        })),
      );
      setAdvancedOpen(true);
    }
    setMessage(
      typedDetailBody.job.failureReason ??
        typedDetailBody.job.lastError ??
        "素材分析完成，正在按推荐方案继续生成。",
    );

    return typedDetailBody;
  }

  async function runAnalyzeJob(nextJobId: string, nextDurationSeconds: 8 | 16 | 24) {
    const analyzeResponse = await fetch(`/api/jobs/${nextJobId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: nextDurationSeconds === 8 ? "lite" : "standard",
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
    const byId = new Map(templateCatalog.map((item) => [item.templateId, item]));

    if (!jobDetail) {
      const estimated = templateCatalog.map((template) => {
        const missingReasons = (template.requiredAssets ?? ["front"])
          .filter((requiredAsset) => !hasRequiredIntent(requiredAsset, uploadedRoles))
          .map(missingIntentReason);
        const missingDetailReason =
          template.detailTypes?.length && !uploadedRoles.has("detail")
            ? ["缺少细节图"]
            : [];

        return {
          templateId: template.templateId,
          displayName: template.displayName,
          description: template.description,
          riskLevel: template.riskLevel,
          selectable: missingReasons.length === 0 && missingDetailReason.length === 0,
          selected: selectedTemplateIds.includes(template.templateId),
          reasons: [...missingReasons, ...missingDetailReason],
        };
      });

      return {
        recommended: estimated.filter(
          (template) => template.selectable && template.riskLevel === "low",
        ) as TemplateAvailabilityCard[],
        optional: estimated.filter(
          (template) => template.selectable && template.riskLevel !== "low",
        ) as TemplateAvailabilityCard[],
        unavailable: estimated.filter(
          (template) => !template.selectable,
        ) as TemplateAvailabilityCard[],
      };
    }

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
  }, [jobDetail, selectedTemplateIds, templateCatalog, uploadedRoles]);

  function addUploadedAsset(asset: UploadedAssetItem) {
    setAssets((current) => [
      ...current.filter((item) => item.intendedRole !== asset.intendedRole),
      asset,
    ]);
  }

  function removeUploadedAsset(assetId: string) {
    setAssets((current) => current.filter((asset) => asset.assetId !== assetId));
  }

  async function createAndAnalyzeJob(useFreeTrialIfAvailable: boolean) {
    if (!isAuthenticated) {
      window.sessionStorage.setItem(
        WORKSPACE_GUEST_DRAFT_KEY,
        serializeWorkspaceGuestDraft({
          mode: useFreeTrialIfAvailable ? "trial" : "paid",
          presetId: selectedPresetId,
          durationSeconds,
          aspectRatio,
          userPrompt,
          intendedAssetRoles: assets.map((asset) => asset.intendedRole),
          fileNames: assets.map((asset) => asset.fileName),
        }),
      );
      window.location.href = loginHref;
      return;
    }

    if (imagesUploading) {
      setMessage("图片上传中，请稍候。");
      return;
    }

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
    setAdvancedOpen(false);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetIds: uploadedAssetIds,
        durationSeconds,
        aspectRatio,
        presetId: selectedPresetId,
        useFreeTrialIfAvailable,
        deviceFingerprint: getOrCreateDeviceFingerprint(),
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setMessage(
        typeof body.message === "string"
          ? body.message
          : "创建任务失败，请检查素材和规格。",
      );
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
    return { jobId: body.jobId as string, detail };
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

  async function requestStoryboard({
    targetJobId,
    templateIds,
  }: {
    targetJobId: string;
    templateIds: string[];
  }) {
    const response = await fetch(`/api/jobs/${targetJobId}/storyboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedTemplateIds: templateIds,
        presetId: selectedPresetId,
        userPrompt,
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
      return null;
    }

    return body as {
      storyboardId: string;
      segments: Array<{
        index: number;
        durationSeconds: number;
        templateId: string;
        prompt: string;
      }>;
    };
  }

  async function generateStoryboard() {
    if (!jobId || selectedTemplateIds.length !== requiredTemplateCount) {
      setMessage(`请选择 ${requiredTemplateCount} 个模板后再生成分镜。`);
      return;
    }

    setBusyAction("storyboard");
    const body = await requestStoryboard({
      targetJobId: jobId,
      templateIds: selectedTemplateIds,
    });
    if (!body) {
      setBusyAction(null);
      return;
    }

    setStoryboardId(body.storyboardId);
    setSegments(body.segments);
    setMessage("分镜草稿已生成，请确认。");
    setBusyAction(null);
  }

  async function confirmStoryboardById({
    targetJobId,
    targetStoryboardId,
  }: {
    targetJobId: string;
    targetStoryboardId: string;
  }) {
    const response = await fetch(`/api/jobs/${targetJobId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyboardId: targetStoryboardId,
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
              : body.error === "generation_submit_failed"
                ? body.message ?? "提交视频生成失败，请稍后重试。"
                : body.error === "storyboard_not_confirmable"
                  ? "这个分镜已经不能重复确认，请打开任务详情查看当前进度。"
                  : "确认分镜失败。",
      );
      return null;
    }

    return body as { jobId: string };
  }

  async function confirmStoryboard() {
    if (!jobId || !storyboardId) {
      return;
    }

    setBusyAction("confirm");
    const body = await confirmStoryboardById({
      targetJobId: jobId,
      targetStoryboardId: storyboardId,
    });
    if (!body) {
      setBusyAction(null);
      return;
    }

    window.location.href = `/jobs/${body.jobId}`;
  }

  async function oneClickGenerate(useFreeTrialIfAvailable: boolean) {
    setBusyAction("one-click");
    const created = await createAndAnalyzeJob(useFreeTrialIfAvailable);
    if (!created) {
      setBusyAction(null);
      return;
    }

    const templateIds = defaultTemplateSelection(
      created.detail,
      durationSeconds,
    );
    if (templateIds.length !== requiredTemplateCount) {
      setMessage(`素材不足，无法自动选择 ${requiredTemplateCount} 个可用模板。`);
      setBusyAction(null);
      return;
    }

    const storyboard = await requestStoryboard({
      targetJobId: created.jobId,
      templateIds,
    });
    if (!storyboard) {
      setBusyAction(null);
      return;
    }
    setStoryboardId(storyboard.storyboardId);
    setSegments(storyboard.segments);

    const confirmed = await confirmStoryboardById({
      targetJobId: created.jobId,
      targetStoryboardId: storyboard.storyboardId,
    });
    if (!confirmed) {
      setBusyAction(null);
      return;
    }

    window.location.href = `/jobs/${confirmed.jobId}`;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div>
            <h2 className="text-base font-medium">创建商品短视频</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              先上传正面主图，再补背面、细节、侧面或场景素材。系统会自动分析素材、选择安全模板并提交生成。
            </p>
          </div>
          <div className="space-y-2 text-right">
            <div className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-[var(--accent)]">
              {durationSeconds} 秒 · {aspectRatio} · {paidCost} 点
            </div>
            {message ? (
              <p className="max-w-sm rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-xs leading-5 text-[var(--muted)]">
                {message}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="mt-5 grid gap-6 xl:min-h-[calc(100svh-13rem)] xl:grid-cols-[minmax(400px,432px)_minmax(0,1fr)] xl:items-stretch"
          data-testid="workspace-main-stage"
        >
          <aside
            className="space-y-5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 xl:min-h-full"
            data-testid="workspace-control-rail"
          >
            <div
              className="flex min-h-16 items-start"
              data-testid="workspace-panel-header"
            >
              <div>
                <h3 className="text-sm font-medium">生成控制</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  主按钮会按推荐模板自动完成分析、分镜和提交。
                </p>
              </div>
            </div>
            <SpecSelector
              aspectRatio={aspectRatio}
              durationSeconds={durationSeconds}
              onAspectRatioChange={setAspectRatio}
              onDurationChange={setDurationSeconds}
            />
            <StylePresetSelector
              onChange={changePreset}
              selectedPresetId={selectedPresetId}
            />
            <div>
              <label
                className="text-xs font-medium text-[var(--muted)]"
                htmlFor="workspace-user-prompt"
              >
                生成意图
              </label>
              <textarea
                className="mt-2 min-h-32 w-full rounded-md border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                id="workspace-user-prompt"
                onChange={(event) => setUserPrompt(event.target.value)}
                value={userPrompt}
              />
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                可选填写卖点、场景或风格偏好；所有文本都会先经过 Creem Moderation。
              </p>
            </div>
            {initialMode === "trial" && trialStatus ? (
              <TrialStatusPanel status={trialStatus} />
            ) : null}
            <div className="rounded-md border border-[var(--line)] bg-white p-3 text-xs leading-5 text-[var(--muted)]">
              付费生成：高清无水印，{durationSeconds} 秒将冻结 {paidCost} 点，质检通过后正式扣除；生成失败会释放冻结点数。
            </div>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busyAction !== null || imagesUploading}
              onClick={() => oneClickGenerate(false)}
              type="button"
            >
              {imagesUploading
                ? "图片上传中..."
                : busyAction === "one-click" || busyAction === "create-job" || busyAction === "analyze"
                  ? "正在生成..."
                  : `付费生成高清无水印 · ${paidCost} 点`}
            </button>
            {canUseFreeTrial ? (
              <div className="space-y-2 rounded-md border border-[var(--line)] bg-white p-3">
                <button
                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busyAction !== null || imagesUploading}
                  onClick={() => oneClickGenerate(true)}
                  type="button"
                >
                  免费试用生成 · 8 秒带水印
                </button>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  免费试用：低分辨率 · 无音频 · 带水印 · 仅低风险模板
                </p>
              </div>
            ) : durationSeconds !== 8 && initialMode === "trial" ? (
              <p className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs leading-5 text-[var(--muted)]">
                免费试用仅支持 8 秒。16/24 秒请使用付费生成。
              </p>
            ) : null}
          </aside>

          <section
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 xl:min-h-full"
            data-testid="workspace-material-panel"
          >
            <div
              className="mb-4 flex min-h-16 items-start justify-between gap-3"
              data-testid="workspace-panel-header"
            >
              <div>
                <h3 className="text-sm font-medium">素材画布</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  正面图是主素材；其他素材用于开放背面、细节和场景模板。
                </p>
              </div>
            </div>
            <UploadPanel
              assets={assets}
              isAuthenticated={isAuthenticated}
              onRemoveUploaded={removeUploadedAsset}
              onUploaded={addUploadedAsset}
              onUploadingChange={setImagesUploading}
            />
          </section>
        </div>
      </section>

      <section
        className="rounded-lg border border-[var(--line)] bg-white p-5"
        data-testid="workspace-deferred-analysis"
      >
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
              {materialWarnings.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {Array.from(new Set(materialWarnings)).join(" ")}
                </div>
              ) : null}
              <TemplatePicker
                onToggle={toggleTemplate}
                optional={templateCards.optional}
                recommended={templateCards.recommended}
                unavailable={templateCards.unavailable}
              />
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {hasPreviewableAssets ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Front
                    </p>
                    <p className="mt-2 text-sm">
                      {uploadedRoles.has("front")
                        ? isAuthenticated
                          ? "已上传"
                          : "已选择"
                        : "未上传"}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Back
                    </p>
                    <p className="mt-2 text-sm">
                      {uploadedRoles.has("back")
                        ? isAuthenticated
                          ? "已上传"
                          : "已选择"
                        : "未上传"}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      Detail
                    </p>
                    <p className="mt-2 text-sm">
                      {uploadedRoles.has("detail")
                        ? isAuthenticated
                          ? "已上传"
                          : "已选择"
                        : "未上传"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  创建任务后会自动分析素材，失败时可在这里重试。
                </p>
              )}
              {hasPreviewableAssets ? (
                <p className="text-sm text-[var(--muted)]">
                  {isAuthenticated
                    ? "基于已上传素材位预估模板，生成前会再次分析校验。"
                    : "基于已选择素材位预估模板，登录后需要重新选择图片并正式上传。"}
                </p>
              ) : null}
              <TemplatePicker
                onToggle={toggleTemplate}
                optional={templateCards.optional}
                recommended={templateCards.recommended}
                unavailable={templateCards.unavailable}
              />
            </div>
          )}
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
          <button
            className="text-left text-base font-medium"
            onClick={() => setAdvancedOpen((current) => !current)}
            type="button"
          >
            高级设置 / 手动预览分镜
          </button>
          {showAdvancedManualControls ? (
            <div className="mt-4 space-y-5">
              <p className="text-sm leading-6 text-[var(--muted)]">
                默认会自动选择推荐模板并提交生成；只有需要手动预览或改模板时再展开这里。
              </p>
              <button
                className="inline-flex h-11 items-center rounded-md border border-[var(--line)] bg-white px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!jobDetail || busyAction !== null}
                onClick={generateStoryboard}
                type="button"
              >
                {busyAction === "storyboard" ? "生成中..." : "生成分镜草稿"}
              </button>

              {storyboardId || segments.length > 0 ? (
                <StoryboardConfirmation
                  aspectRatio={aspectRatio}
                  confirming={busyAction === "confirm"}
                  creditCost={jobDetail?.job.creditCost ?? paidCost}
                  disabled={!storyboardId || busyAction !== null}
                  durationSeconds={durationSeconds}
                  moderationPendingMessage={
                    jobDetail?.job.billingMode === "free_trial"
                      ? "免费试用默认使用低风险模板与 lite 质检。"
                      : jobDetail?.job.billingMode === "paid"
                        ? "付费任务使用高分辨率有声生成与 standard 质检。"
                      : "确认后先审核，再冻结点数并进入片段生成。"
                  }
                  onConfirm={confirmStoryboard}
                  segments={segments}
                />
              ) : null}
            </div>
          ) : null}
      </section>
    </div>
  );
}
