import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { RightsRemovalTable } from "@/components/admin/rights-removal-table";
import {
  createDrizzleAdminRightsRemovalStore,
  listRightsRemovalRequests,
} from "@/server/admin/rights-removal";
import { getAdminSession } from "@/server/auth/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminRightsRemovalPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const requests = await listRightsRemovalRequests({
    store: createDrizzleAdminRightsRemovalStore(),
    filters: { limit: 50 },
  });

  return (
    <AdminShell
      nav={buildAdminNav("/admin/rights-removal")}
      subtitle="核验肖像、版权、商标和隐私通知；最终处理必须由管理员完成并写入审计。"
      title="侵权处理"
    >
      <RightsRemovalTable actorRole={admin.role} requests={requests} />
    </AdminShell>
  );
}
