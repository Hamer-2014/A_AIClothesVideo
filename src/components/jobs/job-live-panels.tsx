"use client";

import { useMemo, useState } from "react";

import { JobDeliverablePanel } from "./job-deliverable-panel";
import { JobProgress, type JobProgressData } from "./job-progress";

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
      ) : null}
    </>
  );
}
