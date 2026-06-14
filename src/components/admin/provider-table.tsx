import type {
  ProviderOpsKey,
  ProviderOpsProvider,
  ProviderOpsRoute,
} from "@/server/admin/providers";

interface ProviderTableProps {
  providers: ProviderOpsProvider[];
  keys: ProviderOpsKey[];
  routes: ProviderOpsRoute[];
}

function SectionTable({
  title,
  columns,
  rows,
  emptyText,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h3 className="text-base font-medium">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--line)] text-sm">
          <thead className="bg-[var(--surface)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <tr>
              {columns.map((column) => (
                <th className="px-4 py-3 font-medium" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr className="align-top" key={`${title}-${index}`}>
                  {row.map((value, valueIndex) => (
                    <td className="px-4 py-4" key={`${title}-${index}-${valueIndex}`}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProviderTable({ providers, keys, routes }: ProviderTableProps) {
  return (
    <div className="space-y-6">
      <SectionTable
        title="Providers"
        columns={["Provider", "显示名", "状态", "Base URL"]}
        emptyText="当前没有 provider 记录。"
        rows={providers.map((provider) => [
          provider.name,
          provider.displayName,
          provider.status,
          provider.baseUrl ?? "-",
        ])}
      />

      <SectionTable
        title="Provider Keys (read-only legacy)"
        columns={[
          "Label",
          "Provider ID",
          "状态",
          "Masked Key",
          "Daily Limit",
          "Current Daily Cost",
          "Concurrency",
          "Failure Count",
        ]}
        emptyText="当前没有历史 provider key。"
        rows={keys.map((key) => [
          key.label,
          key.providerId,
          key.status,
          key.keyPreview,
          key.dailyCostLimit,
          key.currentDailyCost,
          `${key.currentConcurrency}/${key.concurrentLimit}`,
          String(key.failureCount),
        ])}
      />

      <SectionTable
        title="Model Routes (retired)"
        columns={[
          "Purpose",
          "环境",
          "状态",
          "Primary Model",
          "Fallback Model",
          "Min Margin",
          "Public Fallback",
        ]}
        emptyText="model_routes 已退役；视频生成只读取环境变量。"
        rows={routes.map((route) => [
          route.purpose,
          route.environment,
          route.status,
          route.primaryModel,
          route.fallbackModel ?? "-",
          `${route.minMarginPercent}%`,
          route.allowPublicFallback,
        ])}
      />
    </div>
  );
}
