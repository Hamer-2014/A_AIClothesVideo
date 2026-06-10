"use client";

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

function renderTemplateList(
  title: string,
  templates: TemplateAvailabilityCard[],
  onToggle: (templateId: string) => void,
) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-[var(--muted)]">{templates.length}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {templates.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">当前没有内容。</p>
        ) : (
          templates.map((template) => (
            <button
              className={`rounded-md border p-4 text-left transition ${
                template.selectable
                  ? template.selected
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] bg-white"
                  : "border-[var(--line)] bg-[color:rgba(255,255,255,0.55)] text-[var(--muted)]"
              }`}
              disabled={!template.selectable}
              key={template.templateId}
              onClick={() => onToggle(template.templateId)}
              type="button"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{template.displayName}</p>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {template.description}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.14em] opacity-70">
                  {template.riskLevel}
                </span>
              </div>
              {template.warnings?.length ? (
                <p className="mt-3 text-xs opacity-80">
                  风险提示：{template.warnings.join(" / ")}
                </p>
              ) : null}
              {template.reasons?.length ? (
                <p className="mt-3 text-xs opacity-80">
                  不可用原因：{template.reasons.join(" / ")}
                </p>
              ) : null}
            </button>
          ))
        )}
      </div>
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
      {renderTemplateList("推荐模板", recommended, onToggle)}
      {renderTemplateList("可选模板", optional, onToggle)}
      {renderTemplateList("不可用模板", unavailable, onToggle)}
    </div>
  );
}
