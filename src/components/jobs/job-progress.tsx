"use client";

import { useEffect, useState } from "react";

import { userFacingJobMessage } from "@/lib/jobs/user-facing-message";

export interface JobProgressData {
    jobId?: string;
    status: string;
    userVisibleStatus?: string;
    phase: string;
    message?: string | null;
    segmentProgress: {
      total: number;
      queued: number;
      generating: number;
      succeeded: number;
      failed: number;
    };
    stitching: { status: string };
    postQa: { status: string };
    creditCost?: number;
    billingMode?: "free_trial" | "paid" | string;
    creditStatus?: "not_reserved" | "reserved" | "captured" | "released" | "trial" | string;
    downloadReady: boolean;
    finalVideoKey?: string | null;
    coverKey?: string | null;
}

interface JobProgressProps {
  jobId?: string;
  onProgressChange?: (progress: JobProgressData) => void;
  progress: JobProgressData;
}

function phaseLabel(phase: string) {
  switch (phase) {
    case "generation":
      return "片段生成中";
    case "stitching":
      return "拼接中";
    case "post_qa":
      return "质检中";
    case "deliverable":
      return "可下载";
    case "failed":
      return "失败";
    default:
      return "处理中";
  }
}

function statusLabel(status: string, phase: string) {
  if (phase !== "failed" && status === "segment_failed") {
    return phaseLabel(phase);
  }

  switch (status) {
    case "segments_queued":
      return "等待提交生成";
    case "segment_generating":
      return "片段生成中";
    case "segment_failed":
      return "生成失败";
    default:
      return phaseLabel(phase);
  }
}

function shouldPoll(progress: JobProgressData) {
  return (
    !progress.downloadReady &&
    !["failed", "deliverable"].includes(progress.phase)
  );
}

function creditTitle(progress: JobProgressData) {
  if (progress.billingMode === "free_trial" || progress.creditStatus === "trial") {
    return "免费试用 · 不扣点数";
  }

  const amount = progress.creditCost ?? 0;
  switch (progress.creditStatus) {
    case "reserved":
      return `已冻结 ${amount} 点`;
    case "captured":
      return `已扣除 ${amount} 点`;
    case "released":
      return `已释放 ${amount} 点`;
    default:
      return amount > 0 ? `预计冻结 ${amount} 点` : "未产生点数消耗";
  }
}

function creditHint(progress: JobProgressData) {
  switch (progress.creditStatus) {
    case "reserved":
      return "质检通过后正式扣除。";
    case "captured":
      return "视频已通过质检并开放下载。";
    case "released":
      return "任务未交付，冻结点数已退回可用余额。";
    case "trial":
      return "试用任务使用低分辨率、水印输出。";
    default:
      return "点击生成后先冻结，失败会自动释放。";
  }
}

function timelineSteps(progress: JobProgressData) {
  const phases = [
    { key: "asset_analysis", label: "素材检查" },
    { key: "storyboard", label: "分镜生成" },
    { key: "pre_generation", label: "点数冻结" },
    { key: "generation", label: "片段生成" },
    { key: "stitching", label: "视频拼接" },
    { key: "post_qa", label: "质量检查" },
    { key: "deliverable", label: "可下载" },
  ];
  const activeIndex = Math.max(
    0,
    phases.findIndex((phase) => phase.key === progress.phase),
  );

  return phases.map((phase, index) => ({
    ...phase,
    state:
      progress.phase === "failed"
        ? index < activeIndex
          ? "done"
          : index === activeIndex
            ? "failed"
            : "pending"
        : index < activeIndex
          ? "done"
          : index === activeIndex
            ? "active"
            : "pending",
  }));
}

export function JobProgress({
  jobId,
  onProgressChange,
  progress: initialProgress,
}: JobProgressProps) {
  const [progress, setProgress] = useState(initialProgress);

  const pollable = shouldPoll(progress);

  useEffect(() => {
    if (!jobId || !pollable) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${jobId}/progress`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const nextProgress = (await response.json()) as JobProgressData;
      setProgress(nextProgress);
      onProgressChange?.(nextProgress);
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [jobId, onProgressChange, pollable]);

  const done = progress.segmentProgress.succeeded;
  const total = progress.segmentProgress.total;
  const failed = progress.phase === "failed" || progress.segmentProgress.failed > 0;
  const message = failed ? userFacingJobMessage(progress.message) : null;
  const steps = timelineSteps(progress);

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">任务进度</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {statusLabel(progress.status, progress.phase)}
            {total > 0 ? ` · 片段 ${done}/${total}` : ""}
          </p>
        </div>
        <span className="text-sm font-medium">
          {progress.downloadReady ? "下载已开放" : progress.status}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Segment
          </p>
          <p className="mt-2 text-sm">
            成功 {progress.segmentProgress.succeeded} / {progress.segmentProgress.total}
          </p>
        </div>
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Stitch
          </p>
          <p className="mt-2 text-sm">{progress.stitching.status}</p>
        </div>
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Post-QA
          </p>
          <p className="mt-2 text-sm">{progress.postQa.status}</p>
        </div>
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Credits
          </p>
          <p className="mt-2 text-sm">{creditTitle(progress)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{creditHint(progress)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-7">
        {steps.map((step) => (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              step.state === "done"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : step.state === "active"
                  ? "border-[var(--ink)] bg-white text-[var(--ink)]"
                  : step.state === "failed"
                    ? "border-red-200 bg-red-50 text-red-900"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
            key={step.key}
          >
            {step.label}
          </div>
        ))}
      </div>
      {progress.downloadReady ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          任务已完成，可以下载成片。
        </div>
      ) : null}
      {message ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">生成失败原因</p>
          <p className="mt-1">{message}</p>
          {failed ? (
            <p className="mt-2 text-red-800">
              请先确认任务日志；如果是供应商繁忙或临时不可用，可以稍后重试生成。
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
