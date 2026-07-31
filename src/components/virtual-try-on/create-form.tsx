"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, LoaderCircle, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { UploadPanel, type UploadedAssetItem, type UploadSlotRole } from "@/components/workspace/upload-panel";
import { localizeHref, type SiteLocale } from "@/lib/i18n/config";
import { workspaceText } from "@/lib/i18n/workspace";
import type { CaptureProtocolSlot } from "@/lib/video/capture-protocols";
import type { VirtualTryOnMode } from "@/server/virtual-tryon/config";

type RequiredRole = "front" | "back" | "detail";
type SubmissionState = "drafting" | "uploading" | "submitting" | "blocked" | "submitted";

const requiredRolesByMode: Record<VirtualTryOnMode, RequiredRole[]> = {
  front_only: ["front"],
  three_view: ["front", "back", "detail"],
};

function createRequestKey() {
  return crypto.randomUUID();
}

function modeSlots(mode: VirtualTryOnMode, language: SiteLocale): CaptureProtocolSlot[] {
  const isEnglish = language === "en";
  const slots: Record<RequiredRole, CaptureProtocolSlot> = {
    front: {
      role: "front",
      label: isEnglish ? "Front garment" : "服装正面图",
      hint: isEnglish ? "Show the full garment silhouette clearly" : "清楚展示服装整体轮廓",
    },
    back: {
      role: "back",
      label: isEnglish ? "Back garment" : "服装背面图",
      hint: isEnglish ? "Show the back structure and fit" : "展示背面结构与版型",
    },
    detail: {
      role: "detail",
      label: isEnglish ? "Garment detail" : "服装细节图",
      hint: isEnglish ? "Show fabric, neckline, cuff, or print" : "展示面料、领口、袖口或印花",
    },
  };
  return requiredRolesByMode[mode].map((role) => slots[role]);
}

function missingRolesMessage(mode: VirtualTryOnMode, language: SiteLocale) {
  return mode === "front_only"
    ? workspaceText(language, "Add a front garment image.", "请添加服装正面图。")
    : workspaceText(language, "Add front, back, and detail images.", "请添加正面、背面和细节图。")
}

function safeSubmissionError(status: number, language: SiteLocale) {
  if (status === 402) return workspaceText(language, "Not enough credits to create this appearance pack.", "点数不足，无法创建定妆图。");
  if (status === 409) return workspaceText(language, "This submission conflicts with an earlier request. Review the materials and try again.", "本次提交与已有请求冲突，请检查素材后重试。");
  if (status === 503) return workspaceText(language, "The virtual try-on service is temporarily unavailable. Try again shortly.", "虚拟试穿服务暂不可用，请稍后重试。");
  return workspaceText(language, "Could not create the appearance pack. Check the materials and try again.", "无法创建定妆图，请检查素材后重试。");
}

function roleAssetIds(assets: UploadedAssetItem[], mode: VirtualTryOnMode) {
  const uploaded = new Map(
    assets
      .filter((asset) => asset.status === "uploaded")
      .map((asset) => [asset.intendedRole, asset.assetId]),
  );
  return Object.fromEntries(
    requiredRolesByMode[mode].flatMap((role) => {
      const assetId = uploaded.get(role);
      return assetId ? [[role, assetId]] : [];
    }),
  ) as Partial<Record<RequiredRole, string>>;
}

export function VirtualTryOnCreateForm({ language }: { language: SiteLocale }) {
  const router = useRouter();
  const [mode, setMode] = useState<VirtualTryOnMode>("front_only");
  const [assets, setAssets] = useState<UploadedAssetItem[]>([]);
  const [rightsAccepted, setRightsAccepted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [skuName, setSkuName] = useState("");
  const [state, setState] = useState<SubmissionState>("drafting");
  const [message, setMessage] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const payloadFingerprint = useMemo(
    () => `${mode}:${skuName.trim()}:${assets.filter((asset) => asset.status === "uploaded").map((asset) => `${asset.intendedRole}:${asset.assetId}`).sort().join("|")}`,
    [assets, mode, skuName],
  );
  const previousFingerprint = useRef(payloadFingerprint);
  const requiredRoles = requiredRolesByMode[mode];
  const sourceAssetIds = roleAssetIds(assets, mode);
  const allRequiredUploaded = requiredRoles.every((role) => Boolean(sourceAssetIds[role]));
  const canSubmit = rightsAccepted && allRequiredUploaded && !uploading && state !== "submitting" && state !== "submitted";

  useEffect(() => {
    if (previousFingerprint.current !== payloadFingerprint) {
      previousFingerprint.current = payloadFingerprint;
      requestKey.current = null;
    }
  }, [payloadFingerprint]);

  function changeMode(nextMode: VirtualTryOnMode) {
    if (nextMode === mode || state === "submitting") return;
    setMode(nextMode);
    setAssets((current) => current.filter((asset) => requiredRolesByMode[nextMode].includes(asset.intendedRole as RequiredRole)));
    setMessage(null);
    setState("drafting");
  }

  function upsertAsset(asset: UploadedAssetItem) {
    setAssets((current) => [
      ...current.filter((item) => item.intendedRole !== asset.intendedRole),
      asset,
    ]);
    setMessage(null);
    setState(asset.status === "failed" ? "blocked" : "drafting");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setState("submitting");
    setMessage(null);
    const idempotencyKey = requestKey.current ?? createRequestKey();
    requestKey.current = idempotencyKey;
    try {
      const response = await fetch("/api/virtual-try-on", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          mode,
          ...(skuName.trim() ? { skuName: skuName.trim() } : {}),
          sourceAssetIds,
        }),
      });
      const body = await response.json().catch(() => null) as { jobId?: unknown } | null;
      if (!response.ok || !body || typeof body.jobId !== "string") {
        if (response.status === 402) requestKey.current = null;
        setState("blocked");
        setMessage(safeSubmissionError(response.status, language));
        return;
      }
      setState("submitted");
      router.push(localizeHref(`/virtual-try-on/${body.jobId}`, language));
    } catch {
      setState("blocked");
      setMessage(safeSubmissionError(503, language));
    }
  }

  const statusMessage = message
    ?? (uploading
      ? workspaceText(language, "Images are still uploading.", "图片仍在上传中。")
      : !allRequiredUploaded
          ? missingRolesMessage(mode, language)
          : !rightsAccepted
            ? workspaceText(language, "Confirm the commercial-use rights statement to continue.", "请先确认商业使用授权声明。")
            : null);
  const slots = modeSlots(mode, language);

  return (
    <form className="border border-[var(--line)] bg-[var(--surface-raised)]" data-state={state} onSubmit={submit}>
      <fieldset className="border-b border-[var(--line)] px-4 py-4 sm:px-6">
        <legend className="sr-only">{workspaceText(language, "Appearance pack mode", "定妆图模式")}</legend>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{workspaceText(language, "Appearance pack", "模特定妆图")}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{workspaceText(language, "Choose the views you can support with product photography.", "根据已有商品素材选择可交付的定妆视角。")}</p>
          </div>
          <div aria-label={workspaceText(language, "Appearance pack mode", "定妆图模式")} className="inline-flex w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-subtle)] p-1 sm:w-auto" role="group">
            <button aria-pressed={mode === "front_only"} className={`min-h-10 flex-1 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] sm:flex-none ${mode === "front_only" ? "bg-[var(--surface-raised)] text-[var(--ink)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`} disabled={state === "submitting"} onClick={() => changeMode("front_only")} type="button">
              {workspaceText(language, "Front only", "仅正面")}
            </button>
            <button aria-pressed={mode === "three_view"} className={`min-h-10 flex-1 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] sm:flex-none ${mode === "three_view" ? "bg-[var(--surface-raised)] text-[var(--ink)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`} disabled={state === "submitting"} onClick={() => changeMode("three_view")} type="button">
              {workspaceText(language, "Front, side, and back", "正面、侧面与背面")}
            </button>
          </div>
        </div>
      </fieldset>

      <div className="space-y-5 px-4 py-5 sm:px-6">
        <UploadPanel
          assets={assets}
          disabled={state === "submitting" || state === "submitted"}
          language={language}
          onRemoveUploaded={(assetId) => setAssets((current) => current.filter((asset) => asset.assetId !== assetId))}
          onUploaded={upsertAsset}
          onUploadingChange={(nextUploading) => {
            setUploading(nextUploading);
            if (nextUploading) setState("uploading");
            else if (state === "uploading") setState("drafting");
          }}
          rightsAccepted={rightsAccepted}
          onRightsAcceptedChange={(accepted) => {
            setRightsAccepted(accepted);
            setMessage(null);
            if (state === "blocked") setState("drafting");
          }}
          slots={slots}
        />

        <div className="max-w-md">
          <label className="block text-sm font-medium" htmlFor="virtual-try-on-sku">
            {workspaceText(language, "Product name or SKU (optional)", "商品名称或 SKU（可选）")}
          </label>
          <input className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--focus)] disabled:bg-[var(--surface-subtle)]" disabled={state === "submitting"} id="virtual-try-on-sku" maxLength={80} onChange={(event) => setSkuName(event.target.value)} placeholder={workspaceText(language, "e.g. Linen Dress / SKU-1024", "例如亚麻连衣裙 / SKU-1024")} value={skuName} />
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" className="min-h-5 text-sm text-[var(--muted)]">
            {statusMessage ? <p role={message ? "alert" : undefined}>{statusMessage}</p> : null}
          </div>
          <button className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--action)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--line-strong)] sm:w-auto" disabled={!canSubmit} type="submit">
            {state === "submitting" ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : allRequiredUploaded && rightsAccepted ? <WandSparkles aria-hidden="true" size={16} /> : <ImagePlus aria-hidden="true" size={16} />}
            {state === "submitting" ? workspaceText(language, "Submitting appearance pack", "正在提交定妆图") : state === "submitted" ? <><Check aria-hidden="true" size={16} />{workspaceText(language, "Opening task", "正在打开任务")}</> : workspaceText(language, "Create appearance pack", "创建定妆图")}
          </button>
        </div>
      </div>
    </form>
  );
}
