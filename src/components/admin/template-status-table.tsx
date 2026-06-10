interface TemplateStatusTableProps {
  templates: Array<{
    templateId: string;
    version: number;
    displayName: string;
    riskLevel: string;
    status: string;
    isTrialAllowed: boolean;
  }>;
}

export function TemplateStatusTable({
  templates,
}: TemplateStatusTableProps) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <h3 className="text-base font-medium">模板状态</h3>
      <div className="mt-4 space-y-3">
        {templates.map((template) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
            key={`${template.templateId}-${template.version}`}
          >
            <div>
              <p className="text-sm font-medium">
                {template.displayName} ({template.templateId})
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                v{template.version} · {template.riskLevel} ·
                {template.isTrialAllowed ? " 试用可用" : " 试用关闭"}
              </p>
            </div>
            <p className="text-xs text-[var(--muted)]">{template.status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
