"use client";

import { stylePresets, type StylePresetId } from "@/lib/presets";
import type { SiteLocale } from "@/lib/i18n/config";
import { localizeStylePreset, workspaceText } from "@/lib/i18n/workspace";

interface StylePresetSelectorProps {
  selectedPresetId: StylePresetId;
  onChange: (presetId: StylePresetId) => void;
  language?: SiteLocale;
}

export function StylePresetSelector({
  selectedPresetId,
  onChange,
  language = "zh-CN",
}: StylePresetSelectorProps) {
  return (
    <section className="space-y-3" aria-label={workspaceText(language, "Style preset", "风格预设")}>
      <div>
        <p className="text-sm font-medium">{workspaceText(language, "Style preset", "风格预设")}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          {workspaceText(language, "Choose the video use case. Shot recommendations still follow the uploaded-image rules.", "选择视频用途，系统会按素材规则自动推荐镜头。")}
        </p>
      </div>
      <div
        aria-label={workspaceText(language, "Choose a style preset", "选择风格预设")}
        className="grid grid-cols-3 gap-2"
        role="group"
      >
        {stylePresets.map((sourcePreset) => {
          const preset = localizeStylePreset(sourcePreset, language);
          const selected = preset.id === selectedPresetId;

          return (
            <button
              aria-pressed={selected}
              className={`min-h-11 rounded-md border px-2 py-2 text-center transition focus:outline-none focus:ring-2 focus:ring-[var(--focus)] ${
                selected
                  ? "border-[var(--action)] bg-[var(--brand-soft)] text-[var(--ink)]"
                  : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent)]"
              }`}
              key={preset.id}
              onClick={() => onChange(preset.id)}
              type="button"
            >
              <span className="block text-xs font-medium leading-4 sm:text-sm">{preset.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-[var(--muted)]">
        {localizeStylePreset(
          stylePresets.find((preset) => preset.id === selectedPresetId) ?? stylePresets[0],
          language,
        ).shortDescription}
      </p>
    </section>
  );
}
