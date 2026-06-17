type FailureSummaryJob = {
  status: string;
  userVisibleStatus: string;
  failureReason: string | null;
  lastError: string | null;
  billingMode: string | null | undefined;
  creditCost: number;
  reservedLedgerId: string | null;
};

type FailureSummarySegment = {
  id: string;
  segmentIndex: number;
  status: string;
  lastError: string | null;
};

type FailureSummaryStitchJob = {
  id: string;
  status: string;
  lastError: string | null;
};

type FailureSummaryPostQa = {
  id: string;
  status: string;
  mode: string;
  failureCategory: string | null;
};

function hasFailure(job: FailureSummaryJob) {
  return (
    job.status.endsWith("_failed") ||
    job.status.startsWith("failed") ||
    job.status === "prompt_moderation_blocked" ||
    Boolean(job.failureReason || job.lastError)
  );
}

function latestSegmentSummary(segments: FailureSummarySegment[]) {
  const failed = segments.find((segment) => segment.status === "failed");
  const latest = failed ?? segments[segments.length - 1];

  if (!latest) {
    return "-";
  }

  return `segment #${latest.segmentIndex}: ${latest.status}`;
}

function latestStitchSummary(stitchJobs: FailureSummaryStitchJob[]) {
  const failed = stitchJobs.find((stitchJob) => stitchJob.status === "failed");
  const latest = failed ?? stitchJobs[0];

  if (!latest) {
    return "-";
  }

  return `${latest.id}: ${latest.status}`;
}

function latestPostQaSummary(postQaResults: FailureSummaryPostQa[]) {
  const failed = postQaResults.find((result) => result.status === "failed");
  const latest = failed ?? postQaResults[0];

  if (!latest) {
    return "-";
  }

  return `${latest.id}: ${latest.status} / ${latest.mode} / ${latest.failureCategory ?? "-"}`;
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium leading-6">{value || "-"}</p>
    </div>
  );
}

export function JobFailureSummary({
  job,
  segments,
  stitchJobs,
  postQaResults,
}: {
  job: FailureSummaryJob;
  segments: FailureSummarySegment[];
  stitchJobs: FailureSummaryStitchJob[];
  postQaResults: FailureSummaryPostQa[];
}) {
  if (!hasFailure(job)) {
    return (
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">失败摘要</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">暂无失败摘要</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <h3 className="text-base font-medium">失败摘要</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryRow label="Job Status" value={job.status} />
        <SummaryRow label="User Visible Status" value={job.userVisibleStatus} />
        <SummaryRow label="Failure Reason" value={job.failureReason ?? "-"} />
        <SummaryRow label="Last Error" value={job.lastError ?? "-"} />
        <SummaryRow label="Billing Mode" value={job.billingMode} />
        <SummaryRow label="Credit Cost" value={`${job.creditCost} 点`} />
        <SummaryRow label="Reserved Ledger ID" value={job.reservedLedgerId ?? "-"} />
        <SummaryRow label="Segment Latest" value={latestSegmentSummary(segments)} />
        <SummaryRow label="Stitch Latest" value={latestStitchSummary(stitchJobs)} />
        <SummaryRow label="Post-QA Latest" value={latestPostQaSummary(postQaResults)} />
      </div>
    </section>
  );
}
