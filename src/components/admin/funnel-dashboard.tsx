import type { AdminFunnelSummary } from "@/server/admin/funnel";

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function FunnelDashboard({ summary }: { summary: AdminFunnelSummary }) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-medium">Funnel Summary</h3>
          <p className="text-sm text-[var(--muted)]">
            Generated at {summary.generatedAt}
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {summary.eventCounts.map((item) => (
            <div
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
              key={item.eventName}
            >
              <div className="text-xs text-[var(--muted)]">{item.eventName}</div>
              <div className="mt-2 text-2xl font-semibold">{item.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h3 className="text-base font-medium">Conversions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--line)] text-sm">
            <thead className="bg-[var(--surface)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                {["Flow", "Numerator", "Denominator", "Rate"].map((column) => (
                  <th className="px-4 py-3 font-medium" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {summary.conversions.map((item) => (
                <tr key={item.key}>
                  <td className="px-4 py-4">{item.label}</td>
                  <td className="px-4 py-4">{item.numerator}</td>
                  <td className="px-4 py-4">{item.denominator}</td>
                  <td className="px-4 py-4">{formatRate(item.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h3 className="text-base font-medium">Preset Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--line)] text-sm">
            <thead className="bg-[var(--surface)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
              <tr>
                {["Preset", "Jobs", "Deliverable", "Failed", "Downloads"].map(
                  (column) => (
                    <th className="px-4 py-3 font-medium" key={column}>
                      {column}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {summary.presetSummary.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[var(--muted)]" colSpan={5}>
                    暂无 preset funnel 数据。
                  </td>
                </tr>
              ) : (
                summary.presetSummary.map((item) => (
                  <tr key={item.presetId}>
                    <td className="px-4 py-4">{item.presetId}</td>
                    <td className="px-4 py-4">{item.jobCount}</td>
                    <td className="px-4 py-4">{item.deliverableCount}</td>
                    <td className="px-4 py-4">{item.failedCount}</td>
                    <td className="px-4 py-4">{item.downloadCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
