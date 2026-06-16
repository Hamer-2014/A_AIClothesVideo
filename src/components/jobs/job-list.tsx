"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

import { VideoPlaceholder } from "./video-placeholder";

interface JobListItem {
  id: string;
  status: string;
  userVisibleStatus: string;
  durationSeconds: number;
  aspectRatio: string;
  creditCost: number;
  finalVideoKey: string | null;
  coverKey: string | null;
  coverUrl?: string | null;
  failureReason: string | null;
  createdAt: string | Date;
}

function formatStatus(job: JobListItem) {
  if (job.status === "deliverable") {
    return "可下载";
  }
  if (job.status.startsWith("failed")) {
    return "失败 / 已释放";
  }
  if (job.status.startsWith("post_qa")) {
    return "质检中";
  }
  if (job.status.startsWith("segment") || job.status.startsWith("stitch")) {
    return "生成中";
  }

  return job.userVisibleStatus;
}

function JobCoverThumbnail({
  coverUrl,
  label,
}: {
  coverUrl: string | null;
  label: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!coverUrl || failed) {
    return <VideoPlaceholder label={label} variant="thumbnail" />;
  }

  return (
    <Image
      alt="任务封面"
      className="h-20 w-14 flex-none rounded-md bg-black object-cover"
      height={80}
      onError={() => setFailed(true)}
      src={coverUrl}
      unoptimized
      width={56}
    />
  );
}

export function JobList({
  jobs,
}: {
  jobs: JobListItem[];
}) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-6">
        <p className="text-sm font-medium">还没有视频任务</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          从工作台上传服装素材，生成第一条商品短视频。
        </p>
        <Link
          className="mt-4 inline-flex h-10 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white"
          href="/workspace"
        >
          去工作台创建第一个视频
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const coverUrl = job.coverUrl ?? null;
        const statusLabel = formatStatus(job);

        return (
          <Link
            className="block rounded-lg border border-[var(--line)] bg-white px-5 py-4 transition hover:border-[var(--accent)]"
            href={`/jobs/${job.id}`}
            key={job.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 gap-4">
                <JobCoverThumbnail coverUrl={coverUrl} label={statusLabel} />
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium">任务 {job.id.slice(0, 8)}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {job.durationSeconds} 秒 / {job.aspectRatio} / {job.creditCost} 点
                  </p>
                  {job.failureReason ? (
                    <p className="text-xs text-[var(--accent)]">
                      {job.failureReason}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="text-right text-sm">
                <p>{statusLabel}</p>
                <p className="mt-1 text-[var(--muted)]">
                  {new Date(job.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
