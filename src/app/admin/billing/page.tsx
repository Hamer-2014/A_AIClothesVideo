import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
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
      <BillingTable
        wallets={overview.wallets}
        orders={overview.orders}
        ledger={overview.ledger}
      />
    </AdminShell>
  );
}
