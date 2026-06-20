"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buildJobProgressDisplay } from "@/lib/jobs/progress-display";

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
    updatedAt?: string | Date | null;
}

interface JobProgressProps {
  jobId?: string;
  onProgressChange?: (progress: JobProgressData) => void;
  progress: JobProgressData;
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

  const display = buildJobProgressDisplay(progress);

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            任务进度
          </p>
          <h3 className="mt-2 text-xl font-semibold">{display.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {display.description}
          </p>
          {!progress.downloadReady && progress.phase !== "failed" ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              你可以离开此页面，任务会继续处理。完成后可在任务历史中下载。
            </p>
          ) : null}
        </div>
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-medium">
          {display.statusPill}
        </span>
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-6">
        {display.steps.map((step) => (
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
      <div className="mt-5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <p className="text-sm font-medium">{display.creditTitle}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          {display.creditDescription}
        </p>
      </div>
      {display.delayNotice ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {display.delayNotice}
        </div>
      ) : null}
      {progress.downloadReady ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          任务已完成，可以下载成片。
        </div>
      ) : null}
      {display.failureMessage ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
          <p className="font-medium">处理建议</p>
          <p className="mt-1">{display.failureMessage}</p>
          {display.recoveryHref ? (
            <Link
              className="mt-3 inline-flex h-10 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white"
              href={display.recoveryHref}
            >
              返回工作台重新创建
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
