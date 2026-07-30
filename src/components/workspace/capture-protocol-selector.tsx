"use client";

import { Images, PersonStanding, RotateCw } from "lucide-react";

import {
  captureProtocols,
  type CaptureProtocolId,
} from "@/lib/video/capture-protocols";
import type { SiteLocale } from "@/lib/i18n/config";
import { localizeCaptureProtocol, workspaceText } from "@/lib/i18n/workspace";

interface CaptureProtocolSelectorProps {
  selectedId: CaptureProtocolId;
  onChange: (protocolId: CaptureProtocolId) => void;
  language?: SiteLocale;
}

const protocolIcons = {
  product_showcase: Images,
  product_rotation: RotateCw,
  model_turn: PersonStanding,
} satisfies Record<CaptureProtocolId, typeof Images>;

export function CaptureProtocolSelector({
  selectedId,
  onChange,
  language = "zh-CN",
}: CaptureProtocolSelectorProps) {
  return (
    <section aria-labelledby="capture-protocol-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p
            className="text-xs font-semibold uppercase text-[var(--muted)]"
            id="capture-protocol-title"
          >
            {workspaceText(language, "Generation method", "生成方式")}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {workspaceText(language, "Each method requires a specific set of three images.", "不同方式需要不同的三张素材。")}
          </p>
        </div>
      </div>
      <div
        aria-label={workspaceText(language, "Choose a three-image generation method", "选择三图生成方式")}
        className="mt-3 grid grid-cols-3 gap-2"
        role="group"
      >
        {captureProtocols.map((sourceProtocol) => {
          const protocol = localizeCaptureProtocol(sourceProtocol, language);
          const Icon = protocolIcons[protocol.id];
          const active = protocol.id === selectedId;
          return (
            <button
              aria-pressed={active}
              className={`flex min-h-16 w-full items-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-2 text-left transition duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] sm:min-h-24 sm:items-start sm:gap-3 sm:px-3 sm:py-3 ${
                active
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]"
              }`}
              key={protocol.id}
              onClick={() => onChange(protocol.id)}
              type="button"
            >
              <Icon
                aria-hidden="true"
                className={`shrink-0 ${active ? "text-[var(--brand-light)]" : "text-[var(--brand)]"}`}
                size={18}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium sm:text-sm">{protocol.shortLabel}</span>
                  <span
                    className={`hidden text-[10px] font-semibold uppercase sm:inline ${
                      active ? "text-white/65" : "text-[var(--muted)]"
                    }`}
                  >
                    {protocol.availability === "recommended"
                      ? workspaceText(language, "Recommended", "推荐")
                      : workspaceText(language, "Paid Beta", "付费 Beta")}
                  </span>
                </span>
                <span
                  className={`mt-1 hidden text-xs leading-5 sm:block ${
                    active ? "text-white/70" : "text-[var(--muted)]"
                  }`}
                >
                  {protocol.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
