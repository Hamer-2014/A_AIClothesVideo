import type {
  BillingLedgerRecord,
  BillingOrderRecord,
  BillingWalletRecord,
} from "@/server/admin/billing";

interface BillingTableProps {
  wallets: BillingWalletRecord[];
  orders: BillingOrderRecord[];
  ledger: BillingLedgerRecord[];
}

export function BillingTable({ wallets, orders, ledger }: BillingTableProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">钱包</h3>
        <div className="mt-4 space-y-3">
          {wallets.map((wallet) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
              key={String(wallet.id)}
            >
              <div>
                <p className="text-sm font-medium">{String(wallet.userId)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  可用 {String(wallet.availableBalance ?? 0)} / 冻结 {String(wallet.reservedBalance ?? 0)}
                </p>
              </div>
              <p className="text-xs text-[var(--muted)]">
                已消费 {String(wallet.totalCaptured ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">订单</h3>
        <div className="mt-4 space-y-3">
          {orders.map((order) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
              key={String(order.id)}
            >
              <div>
                <p className="text-sm font-medium">{String(order.productCode ?? order.id)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {String(order.userId)}
                </p>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {String(order.status ?? "unknown")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">流水</h3>
        <div className="mt-4 space-y-3">
          {ledger.map((entry) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
              key={String(entry.id)}
            >
              <div>
                <p className="text-sm font-medium">
                  {String(entry.type)} · {String(entry.amount)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {String(entry.userId)}
                </p>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {String(entry.reason ?? "-")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
