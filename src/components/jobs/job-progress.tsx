interface JobProgressProps {
  progress: {
    status: string;
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
  };
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

export function JobProgress({ progress }: JobProgressProps) {
  const done = progress.segmentProgress.succeeded;
  const total = progress.segmentProgress.total;
  const failed = progress.phase === "failed" || progress.segmentProgress.failed > 0;

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">任务进度</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {phaseLabel(progress.phase)}
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
      {progress.message ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">生成失败原因</p>
          <p className="mt-1">{progress.message}</p>
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
