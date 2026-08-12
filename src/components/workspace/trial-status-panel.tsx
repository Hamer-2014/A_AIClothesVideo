import type { TrialStatus } from "@/server/trial/status";
import type { SiteLocale } from "@/lib/i18n/config";
import { localizeHref } from "@/lib/i18n/config";
import { safeWorkspaceMessage, workspaceText } from "@/lib/i18n/workspace";

interface TrialStatusPanelProps {
  status: TrialStatus;
  language?: SiteLocale;
}

function stateLabel(state: TrialStatus["state"], language: SiteLocale) {
  switch (state) {
    case "available":
      return workspaceText(language, "Free trial available", "试用可用");
    case "used":
      return workspaceText(language, "Free trial used", "试用已使用");
    case "unavailable":
      return workspaceText(language, "Free trial unavailable", "试用暂不可用");
  }
}

export function TrialStatusPanel({ status, language: requestedLanguage }: TrialStatusPanelProps) {
  const language = requestedLanguage ?? "zh-CN";
  return (
    <section className="rounded-md border border-[var(--line)] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{stateLabel(status.state, language)}</p>
        {status.state === "available" ? (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {workspaceText(language, "1 use", "1 次")}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        {safeWorkspaceMessage(status.message, language, "Generate one 8-second watermarked video with the free trial.", "试用状态暂不可用。")}
      </p>
      {status.limits ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <span className="rounded-md bg-[var(--surface)] px-2 py-1">
            {workspaceText(language, `${status.limits.durationSeconds} sec`, `${status.limits.durationSeconds} 秒`)}
          </span>
          <span className="rounded-md bg-[var(--surface)] px-2 py-1">
            {safeWorkspaceMessage(status.limits.qualityLabel, language, "Low resolution", status.limits.qualityLabel)}
          </span>
          <span className="rounded-md bg-[var(--surface)] px-2 py-1">
            {safeWorkspaceMessage(status.limits.audioLabel, language, "No audio", status.limits.audioLabel)}
          </span>
          <span className="rounded-md bg-[var(--surface)] px-2 py-1">
            {status.limits.watermarkEnabled
              ? workspaceText(language, "Watermarked", "带水印")
              : workspaceText(language, "No watermark", "无水印")}
          </span>
        </div>
      ) : (
        <a
          className="mt-3 inline-flex h-11 items-center rounded-md border border-[var(--line)] px-3 text-xs font-medium"
          href={requestedLanguage ? localizeHref("/pricing", language) : "/pricing"}
        >
          {workspaceText(language, "Buy credits", "购买点数")}
        </a>
      )}
    </section>
  );
}
