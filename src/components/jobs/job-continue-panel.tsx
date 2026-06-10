"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { StoryboardConfirmation } from "@/components/workspace/storyboard-confirmation";
import {
  TemplatePicker,
  type TemplateAvailabilityCard,
} from "@/components/workspace/template-picker";

interface TemplateCatalogItem {
  templateId: string;
  displayName: string;
  description: string;
  riskLevel: string;
}

interface JobContinuePanelProps {
  job: {
    id: string;
    status: string;
    durationSeconds: number;
    aspectRatio: string;
    creditCost: number;
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
    selectedTemplateIds?: string[];
  } | null;
  templateCatalog: TemplateCatalogItem[];
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

function requiredTemplateCount(durationSeconds: number) {
  return durationSeconds === 8 ? 1 : durationSeconds === 16 ? 2 : 3;
}

function canGenerateStoryboard(status: string) {
  return [
    "asset_analysis_passed",
    "storyboard_draft_ready",
    "asset_analysis_running",
  ].includes(status);
}

export function JobContinuePanel({
  job,
  recommendations,
  latestStoryboard,
  templateCatalog,
}: JobContinuePanelProps) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("保持服装版型稳定，适合商品页宣传。");
  const [storyboardId, setStoryboardId] = useState<string | null>(
    latestStoryboard?.status === "draft" ? latestStoryboard.id : null,
  );
  const [segments, setSegments] = useState<
    Array<{ index: number; durationSeconds: number; templateId: string; prompt: string }>
  >(
    latestStoryboard?.status === "draft"
      ? latestStoryboard.storyboardJson.segments.map((segment) => ({
          index: segment.index,
          durationSeconds: segment.duration_seconds,
          templateId: segment.template_id,
          prompt: segment.prompt,
        }))
      : [],
  );
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(
    Array.isArray(latestStoryboard?.selectedTemplateIds)
      ? latestStoryboard.selectedTemplateIds
      : recommendations.availableTemplateIds.slice(
          0,
          requiredTemplateCount(job.durationSeconds),
        ),
  );

  const templateCards = useMemo(() => {
    const byId = new Map(templateCatalog.map((item) => [item.templateId, item]));

    return {
      recommended: recommendations.recommended.map((item) => ({
        templateId: item.templateId,
        displayName: byId.get(item.templateId)?.displayName ?? item.templateId,
        description: byId.get(item.templateId)?.description ?? "",
        riskLevel: item.riskLevel,
        selectable: true,
        selected: selectedTemplateIds.includes(item.templateId),
        warnings: item.riskWarnings.map(warningLabel),
      })) satisfies TemplateAvailabilityCard[],
      optional: recommendations.optional.map((item) => ({
        templateId: item.templateId,
        displayName: byId.get(item.templateId)?.displayName ?? item.templateId,
        description: byId.get(item.templateId)?.description ?? "",
        riskLevel: item.riskLevel,
        selectable: true,
        selected: selectedTemplateIds.includes(item.templateId),
        warnings: item.riskWarnings.map(warningLabel),
      })) satisfies TemplateAvailabilityCard[],
      unavailable: recommendations.unavailable.map((item) => ({
        templateId: item.templateId,
        displayName: byId.get(item.templateId)?.displayName ?? item.templateId,
        description: byId.get(item.templateId)?.description ?? "",
        riskLevel: byId.get(item.templateId)?.riskLevel ?? "unknown",
        selectable: false,
        selected: false,
        reasons: item.reasons.map(reasonLabel),
      })) satisfies TemplateAvailabilityCard[],
    };
  }, [recommendations, selectedTemplateIds, templateCatalog]);

  function toggleTemplate(templateId: string) {
    setSelectedTemplateIds((current) => {
      if (current.includes(templateId)) {
        return current.filter((item) => item !== templateId);
      }

      if (current.length >= requiredTemplateCount(job.durationSeconds)) {
        return [...current.slice(1), templateId];
      }

      return [...current, templateId];
    });
  }

  async function generateStoryboard() {
    if (selectedTemplateIds.length !== requiredTemplateCount(job.durationSeconds)) {
      setMessage(`请选择 ${requiredTemplateCount(job.durationSeconds)} 个模板后再生成分镜。`);
      return;
    }

    setBusyAction("storyboard");
    setMessage(null);

    try {
      const response = await fetch(`/api/jobs/${job.id}/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedTemplateIds,
          userPrompt,
          isTrial: job.durationSeconds === 8,
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
        return;
      }

      setStoryboardId(body.storyboardId);
      setSegments(body.segments);
      setMessage("分镜草稿已生成，请确认。");
      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmStoryboard() {
    if (!storyboardId) {
      return;
    }

    setBusyAction("confirm");
    setMessage(null);

    try {
      const response = await fetch(`/api/jobs/${job.id}/confirm`, {
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
                : "确认分镜失败。",
        );
        return;
      }

      router.refresh();
    } finally {
      setBusyAction(null);
    }
  }

  if (!canGenerateStoryboard(job.status) && !storyboardId) {
    return null;
  }

  return (
    <section className="space-y-5 rounded-lg border border-[var(--line)] bg-white p-5">
      <div>
        <h2 className="text-base font-medium">继续任务</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          在任务页直接继续分镜与确认流程，不必再回工作台。
        </p>
      </div>

      {canGenerateStoryboard(job.status) ? (
        <>
          <TemplatePicker
            onToggle={toggleTemplate}
            optional={templateCards.optional}
            recommended={templateCards.recommended}
            unavailable={templateCards.unavailable}
          />
          <div>
            <label className="text-sm font-medium" htmlFor="job-user-prompt">
              生成意图
            </label>
            <textarea
              className="mt-3 min-h-32 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              id="job-user-prompt"
              onChange={(event) => setUserPrompt(event.target.value)}
              value={userPrompt}
            />
            <button
              className="mt-4 inline-flex h-11 items-center rounded-md border border-[var(--line)] bg-white px-5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busyAction !== null}
              onClick={generateStoryboard}
              type="button"
            >
              {busyAction === "storyboard" ? "生成中..." : "生成分镜草稿"}
            </button>
          </div>
        </>
      ) : null}

      <StoryboardConfirmation
        aspectRatio={job.aspectRatio}
        creditCost={job.creditCost}
        disabled={!storyboardId || busyAction !== null}
        durationSeconds={job.durationSeconds}
        moderationPendingMessage={
          job.durationSeconds === 8
            ? "免费试用默认使用低风险模板与 lite 质检。"
            : "确认后先审核，再冻结点数并进入片段生成。"
        }
        onConfirm={confirmStoryboard}
        segments={segments}
      />

      {message ? (
        <p className="text-sm text-[var(--accent)]">{message}</p>
      ) : null}
    </section>
  );
}
