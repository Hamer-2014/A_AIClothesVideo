"use client";

import type { SiteLocale } from "@/lib/i18n/config";
import { safeWorkspaceMessage, workspaceText } from "@/lib/i18n/workspace";

interface StoryboardSegment {
  index: number;
  durationSeconds: number;
  templateId: string;
  prompt: string;
}

interface StoryboardConfirmationProps {
  durationSeconds: number;
  aspectRatio: string;
  creditCost: number;
  segments: StoryboardSegment[];
  onConfirm: () => void;
  disabled?: boolean;
  confirming?: boolean;
  moderationPendingMessage?: string | null;
  language?: SiteLocale;
}

export function StoryboardConfirmation({
  durationSeconds,
  aspectRatio,
  creditCost,
  segments,
  onConfirm,
  disabled,
  confirming,
  moderationPendingMessage,
  language = "zh-CN",
}: StoryboardConfirmationProps) {
  const hasDraft = segments.length > 0;

  return (
    <section
      aria-label={workspaceText(language, "Storyboard confirmation", "分镜确认")}
      className="space-y-4 rounded-lg border border-[var(--line)] bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium">{workspaceText(language, "Storyboard confirmation", "分镜确认")}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {workspaceText(language, "Confirmation runs Creem Moderation first, then reserves credits and enters the generation queue.", "确认后会先进行 Creem Moderation，再冻结点数并进入生成队列。")}
          </p>
        </div>
        <div className="space-y-1 text-right text-sm">
          <p>{workspaceText(language, `${durationSeconds} sec`, `${durationSeconds} 秒`)}</p>
          <p className="text-[var(--muted)]">{aspectRatio}</p>
          {hasDraft ? <p className="font-medium">{workspaceText(language, `${creditCost} credits`, `${creditCost} 点`)}</p> : null}
        </div>
      </div>
      <div className="space-y-3">
        {!hasDraft ? (
          <p className="text-sm text-[var(--muted)]">{workspaceText(language, "No storyboard draft yet.", "尚未生成分镜草稿。")}</p>
        ) : (
          segments.map((segment) => (
            <div
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
              key={`${segment.templateId}-${segment.index}`}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium">
                  {workspaceText(language, "Segment", "片段")} {segment.index + 1} / {segments.length}
                </p>
                <span className="text-xs text-[var(--muted)]">
                  {segment.templateId}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {segment.prompt}
              </p>
            </div>
          ))
        )}
      </div>
      {moderationPendingMessage ? (
        <p className="text-sm text-[var(--accent)]">{safeWorkspaceMessage(moderationPendingMessage, language, "Moderation runs before credits are reserved and generation begins.", moderationPendingMessage)}</p>
      ) : null}
      <button
        className="inline-flex h-11 items-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onConfirm}
        type="button"
      >
        {confirming
          ? workspaceText(language, "Submitting...", "正在提交生成...")
          : workspaceText(language, "Confirm storyboard and generate", "确认分镜并生成")}
      </button>
    </section>
  );
}
