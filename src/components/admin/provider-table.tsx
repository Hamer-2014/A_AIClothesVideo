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

export function ProviderTable({ providers, keys, routes }: ProviderTableProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">Providers</h3>
        <div className="mt-4 space-y-3">
          {providers.map((provider) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
              key={String(provider.id)}
            >
              <div>
                <p className="text-sm font-medium">{String(provider.displayName ?? provider.name)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {String(provider.status ?? "unknown")}
                </p>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {String(provider.baseUrl ?? "-")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">Provider Keys</h3>
        <div className="mt-4 space-y-3">
          {keys.map((key) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
              key={String(key.id)}
            >
              <div>
                <p className="text-sm font-medium">{String(key.label)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {String(key.keyPreview ?? "-")}
                </p>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {String(key.status ?? "unknown")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">Model Routes</h3>
        <div className="mt-4 space-y-3">
          {routes.map((route) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
              key={String(route.id)}
            >
              <div>
                <p className="text-sm font-medium">{String(route.purpose)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {String(route.primaryModel ?? "-")}
                </p>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {String(route.status ?? "unknown")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
