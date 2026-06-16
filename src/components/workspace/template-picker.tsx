"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface TemplateAvailabilityCard {
  templateId: string;
  displayName: string;
  description: string;
  riskLevel: string;
  selectable: boolean;
  selected: boolean;
  reasons?: string[];
  warnings?: string[];
}

interface TemplatePickerProps {
  recommended: TemplateAvailabilityCard[];
  optional: TemplateAvailabilityCard[];
  unavailable: TemplateAvailabilityCard[];
  onToggle: (templateId: string) => void;
}

function TemplateCard({
  template,
  onToggle,
}: {
  template: TemplateAvailabilityCard;
  onToggle: (templateId: string) => void;
}) {
  const selectedClass = template.selected
    ? "border-[var(--accent)] bg-cyan-50/70 ring-2 ring-cyan-100"
    : "border-[var(--line)] bg-white hover:border-[var(--accent)]";
  const disabledClass =
    "border-[var(--line)] bg-white/60 text-[var(--muted)] opacity-75";

  return (
    <button
      aria-pressed={template.selectable ? template.selected : undefined}
      className={`rounded-md border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-100 ${
        template.selectable ? selectedClass : disabledClass
      }`}
      disabled={!template.selectable}
      onClick={() => onToggle(template.templateId)}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{template.displayName}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {template.description}
          </p>
        </div>
        <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          {template.riskLevel}
        </span>
      </div>
      {template.warnings?.length ? (
        <p className="mt-3 text-xs text-amber-700">
          风险提示：{template.warnings.join(" / ")}
        </p>
      ) : null}
      {template.reasons?.length ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          不可用原因：{template.reasons.join(" / ")}
        </p>
      ) : null}
    </button>
  );
}

function TemplateSection({
  title,
  templates,
  onToggle,
  priority,
  defaultOpen,
}: {
  title: string;
  templates: TemplateAvailabilityCard[];
  onToggle: (templateId: string) => void;
  priority: "primary" | "secondary" | "muted";
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isPrimary = priority === "primary";
  const isOpen = isPrimary || open;
  const gridClass = isPrimary
    ? "grid gap-3 md:grid-cols-2"
    : "grid gap-3 md:grid-cols-2 xl:grid-cols-3";

  return (
    <section
      aria-label={title}
      className={isPrimary ? "space-y-3" : "space-y-3 border-t border-[var(--line)] pt-4"}
      data-priority={priority}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {isPrimary ? (
          <span className="rounded-full bg-cyan-50 px-2 py-1 text-xs text-[var(--accent)]">
            {templates.length}
          </span>
        ) : (
          <button
            aria-expanded={isOpen}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--line)] bg-white px-3 text-xs text-[var(--muted)] transition hover:border-[var(--accent)]"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            <ChevronDown
              className={`transition ${isOpen ? "rotate-180" : ""}`}
              size={14}
            />
            {isOpen ? "收起" : "展开"}
            {title} {templates.length}
          </button>
        )}
      </div>
      {isOpen ? (
        <div className={gridClass}>
          {templates.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">当前没有内容。</p>
          ) : (
            templates.map((template) => (
              <TemplateCard
                key={template.templateId}
                onToggle={onToggle}
                template={template}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

export function TemplatePicker({
  recommended,
  optional,
  unavailable,
  onToggle,
}: TemplatePickerProps) {
  return (
    <div className="space-y-6">
      <TemplateSection
        defaultOpen
        onToggle={onToggle}
        priority="primary"
        templates={recommended}
        title="推荐模板"
      />
      <TemplateSection
        defaultOpen={false}
        onToggle={onToggle}
        priority="secondary"
        templates={optional}
        title="可选模板"
      />
      <TemplateSection
        defaultOpen={false}
        onToggle={onToggle}
        priority="muted"
        templates={unavailable}
        title="不可用模板"
      />
    </div>
  );
}
