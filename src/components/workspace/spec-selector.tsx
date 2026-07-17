"use client";

import { videoDurations, type VideoDuration } from "@/lib/video/specs";

interface SpecSelectorProps {
  durationSeconds: VideoDuration;
  aspectRatio: "9:16" | "1:1" | "16:9";
  duration40Enabled?: boolean;
  onDurationChange: (value: VideoDuration) => void;
  onAspectRatioChange: (value: "9:16" | "1:1" | "16:9") => void;
}

const aspectRatioOptions = [
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
] as const;

function SegmentedButton<T extends string | number>({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-10 rounded-md border px-3 text-sm font-medium transition ${
        active
          ? "border-[var(--accent-strong)] bg-[var(--accent)] text-white shadow-sm"
          : "border-[var(--line)] bg-white text-[var(--ink)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function SpecSelector({
  durationSeconds,
  duration40Enabled = false,
  aspectRatio,
  onDurationChange,
  onAspectRatioChange,
}: SpecSelectorProps) {
  const durationOptions = videoDurations
    .filter((duration) => duration !== 40 || duration40Enabled)
    .map((duration) => ({
      value: duration,
      label: duration === 40 ? "40 秒 Beta" : `${duration} 秒`,
    }));

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-medium">规格</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {durationOptions.map((option) => (
            <SegmentedButton
              active={durationSeconds === option.value}
              key={option.value}
              label={option.label}
              onClick={() => onDurationChange(option.value)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">比例</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {aspectRatioOptions.map((option) => (
            <SegmentedButton
              active={aspectRatio === option.value}
              key={option.value}
              label={option.label}
              onClick={() => onAspectRatioChange(option.value)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
