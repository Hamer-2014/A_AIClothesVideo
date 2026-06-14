import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProviderTable } from "@/components/admin/provider-table";
import { getAdminSession } from "@/server/auth/admin-session";
import {
  createDrizzleProviderOpsStore,
  getProviderOpsOverview,
} from "@/server/admin/providers";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const overview = await getProviderOpsOverview({
    store: createDrizzleProviderOpsStore(),
  });

  return (
    <AdminShell
      title="视频供应商配置"
      subtitle="视频生成已改为 env-only：provider、model 和 API key 只从运行环境变量读取，后台不再提供 key 或 model route 切换。"
      nav={buildAdminNav("/admin/providers")}
    >
      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--line)] bg-white px-5 py-4">
          <h3 className="text-base font-medium">Env-only 配置</h3>
          <div className="mt-3 grid gap-3 text-sm text-[var(--muted)] md:grid-cols-2">
            <div>
              <div className="font-medium text-[var(--ink)]">当前生效入口</div>
              <p className="mt-1">
                `VIDEO_GENERATION_PROVIDER`、`VIDEO_GENERATION_MODEL`，以及所选 provider 的 API key。
              </p>
            </div>
            <div>
              <div className="font-medium text-[var(--ink)]">后台状态</div>
              <p className="mt-1">
                数据库 provider/key 记录仅用于历史排障查看，不再驱动视频生成，也不能在后台写入或轮换。
              </p>
            </div>
          </div>
        </section>

        <ProviderTable
          providers={overview.providers}
          keys={overview.keys}
          routes={overview.routes}
        />
      </div>
    </AdminShell>
  );
}
