import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { FunnelDashboard } from "@/components/admin/funnel-dashboard";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  createDrizzleAdminFunnelStore,
  getAdminFunnelSummary,
} from "@/server/admin/funnel";
import { getAdminSession } from "@/server/auth/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminFunnelPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const summary = await getAdminFunnelSummary({
    store: createDrizzleAdminFunnelStore(),
  });

  return (
    <AdminShell
      title="漏斗统计"
      subtitle="查看公开试用漏斗的核心服务端事件、转化率和 preset 表现。"
      nav={buildAdminNav("/admin/funnel")}
    >
      <FunnelDashboard summary={summary} />
    </AdminShell>
  );
}
