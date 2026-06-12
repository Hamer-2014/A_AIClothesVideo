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
      <div className="mt-5 grid gap-3 md:grid-cols-3">
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
      </div>
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
