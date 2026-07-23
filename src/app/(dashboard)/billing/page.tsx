import { redirect } from "next/navigation";
import Link from "next/link";
import { CreditCard } from "lucide-react";

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
      subtitle="查看当前可用点数、购买订单和账本流水。"
      nav={buildDashboardNav("/billing")}
      user={session.user}
      billing={overview.wallet}
    >
      <div className="mb-5 flex justify-end">
        <Link
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--action)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
          href="/pricing#credit-packs"
        >
          <CreditCard aria-hidden="true" size={16} />
          Buy credits
        </Link>
      </div>
      <CreditLedger
        wallet={overview.wallet}
        orders={overview.orders}
        ledger={overview.ledger}
      />
    </DashboardShell>
  );
}
