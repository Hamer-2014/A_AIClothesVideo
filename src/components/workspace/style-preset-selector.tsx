"use client";

import { stylePresets, type StylePresetId } from "@/lib/presets";

interface StylePresetSelectorProps {
  selectedPresetId: StylePresetId;
  onChange: (presetId: StylePresetId) => void;
}

export function StylePresetSelector({
  selectedPresetId,
  onChange,
}: StylePresetSelectorProps) {
  return (
    <section className="space-y-3" aria-label="风格预设">
      <div>
        <p className="text-sm font-medium">风格预设</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          选择视频用途，系统会按素材规则自动推荐镜头。
        </p>
      </div>
      <div className="grid gap-2">
        {stylePresets.map((preset) => {
          const selected = preset.id === selectedPresetId;

          return (
            <button
              aria-pressed={selected}
              className={`rounded-md border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-100 ${
                selected
                  ? "border-[var(--accent-strong)] bg-cyan-50 text-[var(--ink)]"
                  : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent)]"
              }`}
              key={preset.id}
              onClick={() => onChange(preset.id)}
              type="button"
            >
              <span className="block text-sm font-medium">{preset.label}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                {preset.shortDescription}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
