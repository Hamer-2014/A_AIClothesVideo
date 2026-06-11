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

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN");
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

export function BillingTable({ wallets, orders, ledger }: BillingTableProps) {
  return (
    <div className="space-y-6">
      <SectionTable
        title="钱包"
        columns={["Wallet", "User", "可用", "冻结", "累计购买", "累计赠送", "累计消耗"]}
        emptyText="当前没有钱包记录。"
        rows={wallets.map((wallet) => [
          wallet.id,
          wallet.userId,
          String(wallet.availableBalance),
          String(wallet.reservedBalance),
          String(wallet.totalPurchased),
          String(wallet.totalGranted),
          String(wallet.totalCaptured),
        ])}
      />

      <SectionTable
        title="订单"
        columns={["Order", "User", "状态", "Provider", "产品", "金额", "点数", "创建时间"]}
        emptyText="当前没有订单记录。"
        rows={orders.map((order) => [
          order.id,
          order.userId,
          order.status,
          order.provider,
          order.productCode,
          `${(order.amountCents / 100).toFixed(2)} ${order.currency}`,
          String(order.creditsGranted),
          formatDateTime(order.createdAt),
        ])}
      />

      <SectionTable
        title="Credit Ledger"
        columns={["Ledger", "User", "Type", "Amount", "关联任务", "关联订单", "Reason", "创建时间"]}
        emptyText="当前没有点数流水。"
        rows={ledger.map((entry) => [
          entry.id,
          entry.userId,
          entry.type,
          String(entry.amount),
          entry.relatedJobId ?? "-",
          entry.relatedOrderId ?? "-",
          entry.reason,
          formatDateTime(entry.createdAt),
        ])}
      />
    </div>
  );
}
