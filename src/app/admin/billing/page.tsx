import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { BillingTable } from "@/components/admin/billing-table";
import { getAdminSession } from "@/server/auth/admin-session";
import {
  createDrizzleBillingOpsStore,
  getBillingOpsOverview,
} from "@/server/admin/billing";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const overview = await getBillingOpsOverview({
    store: createDrizzleBillingOpsStore(),
  });

  return (
    <AdminShell
      title="点数与订单"
      subtitle="查看钱包、订单和流水，确认补点、释放和 capture 行为没有乱账。"
      nav={buildAdminNav("/admin/billing")}
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminActionForm
            description="手动补点用于赔付、异常补偿或运营兜底。必须填写可审计原因。"
            endpoint="/api/admin/credits/adjust"
            fields={[
              {
                name: "userId",
                label: "目标用户",
                placeholder: "输入用户 ID",
              },
              {
                name: "amount",
                label: "补点数量",
                type: "number",
                defaultValue: "25",
              },
            ]}
            submitLabel="执行补点"
            title="Admin Credit Adjustment"
          />
        </div>

        <BillingTable
          wallets={overview.wallets}
          orders={overview.orders}
          ledger={overview.ledger}
        />
      </div>
    </AdminShell>
  );
}
