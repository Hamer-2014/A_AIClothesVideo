"use client";

import Link from "next/link";
import { Download, LoaderCircle, LockKeyhole, RefreshCw, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { localizeHref, type SiteLocale } from "@/lib/i18n/config";
import { workspaceText } from "@/lib/i18n/workspace";
import type { OwnedVirtualTryOnDetail } from "@/server/virtual-tryon/owner";

type DetailResponse = Pick<OwnedVirtualTryOnDetail, "job" | "pack" | "views"> & { videoBridge: OwnedVirtualTryOnDetail["bridge"] };

const terminalStatuses = new Set(["ready", "locked", "failed_unreserved", "failed_released", "failed_refunded"]);
const failedStatuses = new Set(["failed_unreserved", "failed_released", "failed_refunded", "recovering_release", "recovering_refund"]);
const viewOrder = { front: 0, side: 1, back: 2 } as const;

function fromResponse(response: DetailResponse): OwnedVirtualTryOnDetail {
  return { job: response.job, pack: response.pack, views: response.views, bridge: response.videoBridge };
}

function isDeliverable(detail: OwnedVirtualTryOnDetail) {
  return (detail.job.status === "ready" || detail.job.status === "locked") && (detail.pack.status === "ready" || detail.pack.status === "locked");
}

function statusCopy(status: string, language: SiteLocale) {
  const content: Record<string, [string, string]> = {
    queued: ["Waiting to generate", "正在排队"],
    generating: ["Generating appearance views", "正在生成试穿视图"],
    qa_queued: ["Verifying garment and model consistency", "正在严格核验"],
    capturing: ["Finalizing delivery", "正在确认交付"],
    ready: ["Appearance pack ready", "定妆图已就绪"],
    locked: ["Appearance pack locked", "定妆图已锁定"],
    failed_unreserved: ["Credits could not be reserved; no images were created", "未能预留点数，未创建图片"],
    recovering_release: ["Appearance pack was not delivered; reserved credits are being released", "本次定妆未通过交付，点数正在释放"],
    failed_released: ["Appearance pack was not delivered", "本次定妆未交付，点数已释放"],
    recovering_refund: ["Delivery could not complete; credits are being refunded", "交付未完成，点数正在退款"],
    failed_refunded: ["Delivery could not complete; credits were refunded", "交付未完成，点数已退款"],
  };
  const [english, chinese] = content[status] ?? ["Preparing appearance pack", "正在准备定妆图"];
  return workspaceText(language, english, chinese);
}

function progressState(status: string, index: number) {
  if (failedStatuses.has(status)) return index === 0 ? "done" : index === 1 ? "failed" : "pending";
  if (status === "queued") return index === 0 ? "done" : index === 1 ? "active" : "pending";
  if (status === "generating") return index <= 1 ? (index === 1 ? "active" : "done") : "pending";
  if (status === "qa_queued") return index <= 1 ? "done" : index === 2 ? "active" : "pending";
  if (status === "capturing") return index <= 2 ? "done" : index === 3 ? "active" : "pending";
  return "done";
}

function viewLabel(view: string, language: SiteLocale) {
  const label = view === "front" ? ["Front", "正面"] : view === "side" ? ["Side", "侧面"] : ["Back", "背面"];
  return workspaceText(language, label[0], label[1]);
}

function safeDetailError(language: SiteLocale) {
  return workspaceText(language, "Status could not be refreshed. Try again shortly.", "状态暂时无法刷新，请稍后重试。");
}

export function VirtualTryOnPackDetail({ initialDetail, language }: { initialDetail: OwnedVirtualTryOnDetail; language: SiteLocale }) {
  const [detail, setDetail] = useState(initialDetail);
  const [refreshing, setRefreshing] = useState(false);
  const [locking, setLocking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const terminal = terminalStatuses.has(detail.job.status);
  const deliverable = isDeliverable(detail);
  const failed = failedStatuses.has(detail.job.status);
  const canLock = detail.job.status === "ready" && detail.pack.status === "ready";
  const views = useMemo(
    () => detail.views
      .filter((view) => detail.job.mode === "three_view" || view.view === "front")
      .sort((left, right) => viewOrder[left.view] - viewOrder[right.view]),
    [detail.job.mode, detail.views],
  );

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/virtual-try-on/${detail.job.id}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("detail_refresh_failed");
      const responseDetail = await response.json() as DetailResponse;
      setDetail(fromResponse(responseDetail));
      setMessage(null);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && !signal?.aborted) setMessage(safeDetailError(language));
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, [detail.job.id, language]);

  useEffect(() => {
    if (terminal) return;
    const controller = new AbortController();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refresh(controller.signal);
    }, 5000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh, terminal]);

  async function lockPack() {
    if (!canLock || locking) return;
    setLocking(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/virtual-try-on/${detail.job.id}/lock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId: detail.pack.id }) });
      if (!response.ok) {
        setMessage(response.status === 409
          ? workspaceText(language, "This appearance pack could no longer be locked. Refresh its status and try again.", "该定妆图当前无法锁定，请刷新状态后重试。")
          : workspaceText(language, "Could not lock this appearance pack. Try again shortly.", "无法锁定该定妆图，请稍后重试。"));
        return;
      }
      const result = await response.json() as { status?: string; lockedAt?: string | null };
      if (result.status !== "locked") throw new Error("lock_response_invalid");
      const lockedAt = typeof result.lockedAt === "string" ? new Date(result.lockedAt) : new Date();
      setDetail((current) => ({ ...current, job: { ...current.job, status: "locked" }, pack: { ...current.pack, status: "locked", lockedAt }, bridge: current.bridge ?? { kind: "virtual_tryon_appearance_pack", appearancePackId: current.pack.id, version: current.pack.version, mode: current.job.mode, assetIds: current.views.map((view) => view.id), provenance: "generated_apimart_gpt_image_2", videoGeneration: "not_enabled" } }));
    } catch {
      setMessage(workspaceText(language, "Could not lock this appearance pack. Try again shortly.", "无法锁定该定妆图，请稍后重试。"));
    } finally {
      setLocking(false);
    }
  }

  const progressSteps = [
    workspaceText(language, "Materials confirmed", "素材已确认"),
    workspaceText(language, "Generate views", "生成视图"),
    workspaceText(language, "Strict verification", "严格核验"),
    workspaceText(language, "Available to download", "可下载"),
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-6" data-state={detail.job.status}>
      <div className="border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{statusCopy(detail.job.status, language)}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail.job.mode === "three_view" ? workspaceText(language, "Front, side, and back appearance pack", "正面、侧面与背面定妆图") : workspaceText(language, "Front appearance pack", "正面定妆图")}</p>
          </div>
          <button aria-label={workspaceText(language, "Refresh status", "刷新状态")} className="inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-60" disabled={refreshing || locking} onClick={() => void refresh()} title={workspaceText(language, "Refresh status", "刷新状态")} type="button">
            <RefreshCw aria-hidden="true" className={refreshing ? "animate-spin" : undefined} size={17} />
          </button>
        </div>
        <ol aria-label={workspaceText(language, "Appearance pack progress", "定妆图进度")} className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {progressSteps.map((step, index) => {
            const state = progressState(detail.job.status, index);
            return <li className="flex min-w-0 items-center gap-2 text-sm" data-progress={state} key={step}><span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${state === "done" ? "border-[var(--action)] bg-[var(--action)] text-white" : state === "active" ? "border-[var(--action)] text-[var(--action)]" : state === "failed" ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--line-strong)] text-[var(--muted)]"}`}>{index + 1}</span><span className="truncate">{step}</span></li>;
          })}
        </ol>
      </div>

      {message ? <p aria-live="polite" className="text-sm text-[var(--danger)]" role="alert">{message}</p> : null}

      {failed ? (
        <div className="border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-6 sm:px-6">
          <p className="max-w-2xl text-sm text-[var(--muted)]">{statusCopy(detail.job.status, language)}</p>
          <Link className="mt-4 inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--action)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" href={localizeHref("/virtual-try-on", language)}>{workspaceText(language, "Create another appearance pack", "创建新的定妆图")}</Link>
        </div>
      ) : deliverable ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {views.map((view) => {
              const label = viewLabel(view.view, language);
              const previewUrl = `/api/virtual-try-on/${detail.job.id}/assets/${view.id}/download?preview=1`;
              const downloadUrl = `/api/virtual-try-on/${detail.job.id}/assets/${view.id}/download`;
              return <article className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-raised)]" key={view.id}>
                <div className="aspect-[2/3] bg-[var(--surface-subtle)]">
                  {/* Keep the preview on the owner-gated route; a remote optimizer would change its access boundary. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={`${label} ${workspaceText(language, "appearance view", "定妆视图")}`} className="size-full object-contain" src={previewUrl} />
                </div>
                <div className="flex items-center justify-between gap-3 px-3 py-3"><p className="text-sm font-semibold">{label}</p><a aria-label={workspaceText(language, `Download ${label} view`, `下载${label}定妆图`)} className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" href={downloadUrl} title={workspaceText(language, `Download ${label} view`, `下载${label}定妆图`)}><Download aria-hidden="true" size={16} /></a></div>
              </article>;
            })}
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            {canLock ? <button className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--action)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--action-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--line-strong)]" disabled={locking || refreshing} onClick={() => void lockPack()} type="button">{locking ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <LockKeyhole aria-hidden="true" size={16} />}{locking ? workspaceText(language, "Locking appearance pack", "正在锁定定妆图") : workspaceText(language, "Lock appearance pack", "锁定定妆图")}</button> : <span />}
            {detail.bridge?.videoGeneration === "not_enabled" ? <button className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--line)] px-3 text-sm text-[var(--muted)]" disabled title={workspaceText(language, "Video generation is coming soon", "视频生成功能即将推出")} type="button"><Video aria-hidden="true" size={16} />{workspaceText(language, "Continue to video generation (coming soon)", "继续生成视频（即将推出）")}</button> : null}
          </div>
        </div>
      ) : (
        <div className="min-h-72 border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-8 sm:px-6">
          <p className="text-sm text-[var(--muted)]">{workspaceText(language, "This page updates as the appearance pack moves through generation and strict verification.", "定妆图会依次完成生成与严格核验，本页将自动更新状态。")}</p>
        </div>
      )}
    </section>
  );
}
