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

export function TemplateStatusTable({ templates }: TemplateStatusTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-base font-medium">模板状态</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--line)] text-sm">
          <thead className="bg-[var(--surface)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Template ID</th>
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">版本</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">风险级别</th>
              <th className="px-4 py-3 font-medium">试用资格</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {templates.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={6}>
                  当前没有模板记录。
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr className="align-top" key={`${template.templateId}-${template.version}`}>
                  <td className="px-4 py-4 font-medium">{template.templateId}</td>
                  <td className="px-4 py-4">{template.displayName}</td>
                  <td className="px-4 py-4">v{template.version}</td>
                  <td className="px-4 py-4">{template.status}</td>
                  <td className="px-4 py-4">{template.riskLevel}</td>
                  <td className="px-4 py-4">
                    {template.isTrialAllowed ? "试用可用" : "试用关闭"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
