import Link from "next/link";

interface JobListItem {
  id: string;
  status: string;
  userVisibleStatus: string;
  durationSeconds: number;
  aspectRatio: string;
  creditCost: number;
  finalVideoKey: string | null;
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

export function JobList({ jobs }: { jobs: JobListItem[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-6">
        <p className="text-sm text-[var(--muted)]">还没有视频任务。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Link
          className="block rounded-lg border border-[var(--line)] bg-white px-5 py-4 transition hover:border-[var(--accent)]"
          href={`/jobs/${job.id}`}
          key={job.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">任务 {job.id.slice(0, 8)}</p>
              <p className="text-sm text-[var(--muted)]">
                {job.durationSeconds} 秒 / {job.aspectRatio} / {job.creditCost} 点
              </p>
              {job.failureReason ? (
                <p className="text-xs text-[var(--accent)]">{job.failureReason}</p>
              ) : null}
            </div>
            <div className="text-right text-sm">
              <p>{formatStatus(job)}</p>
              <p className="mt-1 text-[var(--muted)]">
                {new Date(job.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
