import { SUPPORT_EMAIL } from "@/lib/support-email";

interface BillingOverviewProps {
  wallet: {
    availableBalance: number;
    reservedBalance: number;
    totalPurchased: number;
    totalGranted: number;
    totalCaptured: number;
  } | null;
  orders: Array<{
    id: string;
    status: string;
    productCode: string;
    amountCents: number;
    creditsGranted: number;
    createdAt: string | Date;
  }>;
  ledger: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: string | Date;
  }>;
}

export function CreditLedger({ wallet, orders, ledger }: BillingOverviewProps) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            可用点数
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {wallet?.availableBalance ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            冻结点数
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {wallet?.reservedBalance ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            已消费
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {wallet?.totalCaptured ?? 0}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">订单</h3>
        <div className="mt-4 space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">暂无订单。</p>
          ) : (
            orders.map((order) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
                key={order.id}
              >
                <div>
                  <p className="text-sm font-medium">{order.productCode}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {order.creditsGranted} 点 / ${(order.amountCents / 100).toFixed(2)}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--muted)]">
                  <p>{order.status}</p>
                  <p className="mt-1">
                    {new Date(order.createdAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h3 className="text-base font-medium">点数流水</h3>
        <div className="mt-4 space-y-3">
          {ledger.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">暂无流水。</p>
          ) : (
            ledger.map((entry) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0"
                key={entry.id}
              >
                <div>
                  <p className="text-sm font-medium">
                    {entry.type} · {entry.amount} 点
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{entry.reason}</p>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {new Date(entry.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="border-t border-[var(--line)] pt-5">
        <h3 className="text-base font-medium">Support</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          For billing, generation, or account help, email{" "}
          <a
            className="font-medium text-[var(--accent)] underline underline-offset-4"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          . We aim to respond within three business days.
        </p>
      </section>
    </div>
  );
}
