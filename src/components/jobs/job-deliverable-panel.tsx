"use client";

import { useMemo, useState } from "react";

interface JobDeliverablePanelProps {
  jobId: string;
  previewUrl: string | null;
  defaultFilename: string;
}

function safeFilename(value: string) {
  const trimmed = value
    .trim()
    .replace(/[\\/]+/g, "_")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "_")
    .replace(/^[._]+/, "");
  return trimmed.endsWith(".mp4") ? trimmed : `${trimmed || "video"}.mp4`;
}

export function JobDeliverablePanel({
  jobId,
  previewUrl,
  defaultFilename,
}: JobDeliverablePanelProps) {
  const [filename, setFilename] = useState(defaultFilename);
  const downloadHref = useMemo(
    () =>
      `/api/jobs/${jobId}/download?filename=${encodeURIComponent(
        safeFilename(filename),
      )}`,
    [filename, jobId],
  );

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">成片预览</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            可先在线播放确认效果，再用自定义文件名下载 MP4。
          </p>
        </div>
        <div className="w-full max-w-sm">
          <label
            className="text-xs font-medium text-[var(--muted)]"
            htmlFor="video-filename"
          >
            下载文件名
          </label>
          <div className="mt-2 flex gap-2">
            <input
              className="h-10 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
              id="video-filename"
              onChange={(event) => setFilename(event.target.value)}
              value={filename}
            />
            <a
              className="inline-flex h-10 items-center whitespace-nowrap rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white"
              href={downloadHref}
            >
              下载成片
            </a>
          </div>
        </div>
      </div>
      {previewUrl ? (
        <video
          className="mx-auto mt-5 max-h-[420px] w-full max-w-3xl rounded-lg bg-black object-contain"
          controls
          playsInline
          preload="metadata"
          src={previewUrl}
        >
          当前浏览器不支持视频预览。
        </video>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          视频预览需要先配置公开 R2 访问域名。
        </div>
      )}
    </section>
  );
}
