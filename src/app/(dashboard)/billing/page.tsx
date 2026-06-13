import { redirect } from "next/navigation";

import { CreditLedger } from "@/components/billing/credit-ledger";
import { DashboardShell } from "@/components/dashboard/shell";
import { buildDashboardNav } from "@/app/app-shell";
import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleUserBillingStore,
  getUserBillingOverview,
} from "@/server/billing/user-billing";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getServerSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const overview = await getUserBillingOverview({
    store: createDrizzleUserBillingStore(),
    userId,
  });

  return (
    <DashboardShell
      title="点数账单"
      subtitle="查看当前可用点数、订单和账本流水。支付申请未开通前，不伪造购买成功。"
      nav={buildDashboardNav("/billing")}
      user={session.user}
      billing={overview.wallet}
    >
      <CreditLedger
        wallet={overview.wallet}
        orders={overview.orders}
        ledger={overview.ledger}
      />
    </DashboardShell>
  );
}
