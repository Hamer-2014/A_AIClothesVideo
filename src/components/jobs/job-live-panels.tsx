"use client";

import { useMemo, useState } from "react";

import { JobDeliverablePanel } from "./job-deliverable-panel";
import { JobProgress, type JobProgressData } from "./job-progress";
import { VideoPlaceholder } from "./video-placeholder";

interface JobLivePanelsProps {
  defaultFilename: string;
  initialPreviewUrl: string | null;
  initialProgress: JobProgressData;
  jobId: string;
  publicVideoBaseUrl?: string;
}

function publicVideoUrl({
  baseUrl,
  key,
}: {
  baseUrl?: string;
  key?: string | null;
}) {
  if (!baseUrl || !key) {
    return null;
  }

  return `${baseUrl.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

function placeholderCopy(progress: JobProgressData) {
  if (progress.phase === "failed" || progress.status.startsWith("failed")) {
    return {
      label: "生成失败",
      description: "本次任务未产生成片，请查看上方失败原因后决定是否重试。",
    };
  }

  if (progress.phase === "post_qa" || progress.status.startsWith("post_qa")) {
    return {
      label: "质检中",
      description: "成片已经进入质量检查，通过后会开放预览和下载。",
    };
  }

  if (
    progress.phase === "generation" ||
    progress.phase === "stitching" ||
    progress.status.startsWith("stitch")
  ) {
    return {
      label: "生成中",
      description: "系统正在生成并拼接视频片段，完成后这里会显示成片预览。",
    };
  }

  return {
    label: "等待生成",
    description: "任务正在排队或准备素材，开始生成后进度会自动更新。",
  };
}

export function JobLivePanels({
  defaultFilename,
  initialPreviewUrl,
  initialProgress,
  jobId,
  publicVideoBaseUrl,
}: JobLivePanelsProps) {
  const [progress, setProgress] = useState(initialProgress);
  const previewUrl = useMemo(
    () =>
      progress.finalVideoKey
        ? publicVideoUrl({
            baseUrl: publicVideoBaseUrl,
            key: progress.finalVideoKey,
          })
        : initialPreviewUrl,
    [initialPreviewUrl, progress.finalVideoKey, publicVideoBaseUrl],
  );
  const coverUrl = progress.coverKey ? `/api/jobs/${jobId}/cover` : null;
  const pendingPreview = placeholderCopy(progress);

  return (
    <>
      <JobProgress
        jobId={jobId}
        onProgressChange={setProgress}
        progress={progress}
      />

      {progress.downloadReady ? (
        <JobDeliverablePanel
          coverUrl={coverUrl}
          defaultFilename={defaultFilename}
          jobId={jobId}
          previewUrl={previewUrl}
        />
      ) : (
        <VideoPlaceholder
          description={pendingPreview.description}
          label={pendingPreview.label}
        />
      )}
    </>
  );
}
