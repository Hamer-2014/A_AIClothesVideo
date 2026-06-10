"use client";

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
  moderationPendingMessage?: string | null;
}

export function StoryboardConfirmation({
  durationSeconds,
  aspectRatio,
  creditCost,
  segments,
  onConfirm,
  disabled,
  moderationPendingMessage,
}: StoryboardConfirmationProps) {
  return (
    <section className="space-y-5 rounded-lg border border-[var(--line)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium">分镜确认</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            确认后会先进行 Creem Moderation，再冻结点数并进入生成队列。
          </p>
        </div>
        <div className="space-y-1 text-right text-sm">
          <p>{durationSeconds} 秒</p>
          <p className="text-[var(--muted)]">{aspectRatio}</p>
          <p className="font-medium">{creditCost} 点</p>
        </div>
      </div>
      <div className="space-y-3">
        {segments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">尚未生成分镜草稿。</p>
        ) : (
          segments.map((segment) => (
            <div
              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
              key={`${segment.templateId}-${segment.index}`}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium">
                  片段 {segment.index + 1} / {segments.length}
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
        <p className="text-sm text-[var(--accent)]">{moderationPendingMessage}</p>
      ) : null}
      <button
        className="inline-flex h-11 items-center rounded-md bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={onConfirm}
        type="button"
      >
        确认分镜并生成
      </button>
    </section>
  );
}
