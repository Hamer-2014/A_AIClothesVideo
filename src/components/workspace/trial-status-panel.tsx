import type { TrialStatus } from "@/server/trial/status";

interface TrialStatusPanelProps {
  status: TrialStatus;
}

function stateLabel(state: TrialStatus["state"]) {
  switch (state) {
    case "available":
      return "试用可用";
    case "used":
      return "试用已使用";
    case "unavailable":
      return "试用暂不可用";
  }
}

export function TrialStatusPanel({ status }: TrialStatusPanelProps) {
  return (
    <section className="rounded-md border border-[var(--line)] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{stateLabel(status.state)}</p>
        {status.state === "available" ? (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            1 次
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        {status.message}
      </p>
      {status.limits ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <span className="rounded-md bg-[var(--surface)] px-2 py-1">
            {status.limits.durationSeconds} 秒
          </span>
          <span className="rounded-md bg-[var(--surface)] px-2 py-1">
            {status.limits.qualityLabel}
          </span>
          <span className="rounded-md bg-[var(--surface)] px-2 py-1">
            {status.limits.audioLabel}
          </span>
          <span className="rounded-md bg-[var(--surface)] px-2 py-1">
            {status.limits.watermarkEnabled ? "带水印" : "无水印"}
          </span>
        </div>
      ) : (
        <a
          className="mt-3 inline-flex h-9 items-center rounded-md border border-[var(--line)] px-3 text-xs font-medium"
          href="/pricing"
        >
          购买点数
        </a>
      )}
    </section>
  );
}
