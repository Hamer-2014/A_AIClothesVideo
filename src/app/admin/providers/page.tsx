import { redirect } from "next/navigation";

import { buildAdminNav } from "@/app/app-shell";
import { AdminActionForm } from "@/components/admin/action-form";
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
      title="供应商与路由"
      subtitle="这里只显示 key preview，不显示完整密钥；主要用于暂停 key、检查路由和定位供应商状态。"
      nav={buildAdminNav("/admin/providers")}
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminActionForm
            description="新增 provider key。完整 key 只提交一次，服务端加密保存，页面不会回显。"
            endpoint="/api/admin/provider-keys"
            fields={[
              {
                name: "providerId",
                label: "Provider ID",
                placeholder: "输入 provider id",
              },
              {
                name: "label",
                label: "Label",
                placeholder: "EvoLink staging",
              },
              {
                name: "environment",
                label: "Environment",
                defaultValue: "staging",
              },
              {
                name: "plainKey",
                label: "Plain Key",
                placeholder: "只提交一次，不会回显",
              },
              {
                name: "dailyCostLimit",
                label: "Daily Cost Limit",
                defaultValue: "20.00",
              },
              {
                name: "concurrentLimit",
                label: "Concurrent Limit",
                type: "number",
                defaultValue: "1",
              },
              {
                name: "status",
                label: "初始状态",
                type: "select",
                defaultValue: "paused",
                options: [
                  { label: "paused", value: "paused" },
                  { label: "active", value: "active" },
                  { label: "exhausted", value: "exhausted" },
                  { label: "error", value: "error" },
                ],
              },
            ]}
            submitLabel="新增 Key"
            title="Create Provider Key"
          />

          {overview.keys.map((key) => (
            <AdminActionForm
              description={`更新 ${key.label} 的状态。operator 无权执行，必须由 admin 提交。`}
              endpoint={`/api/admin/provider-keys/${key.id}/status`}
              fields={[
                {
                  name: "status",
                  label: "目标状态",
                  type: "select",
                  defaultValue: key.status,
                  options: [
                    { label: "active", value: "active" },
                    { label: "paused", value: "paused" },
                    { label: "exhausted", value: "exhausted" },
                    { label: "error", value: "error" },
                  ],
                },
              ]}
              key={key.id}
              submitLabel="更新 Key 状态"
              title={`Key ${key.label}`}
            />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {overview.keys.map((key) => (
            <AdminActionForm
              description={`轮换 ${key.label}。完整 key 只提交一次，服务端加密保存，页面不会回显。`}
              endpoint={`/api/admin/provider-keys/${key.id}/rotate`}
              fields={[
                {
                  name: "plainKey",
                  label: "New Plain Key",
                  placeholder: "只提交一次，不会回显",
                },
              ]}
              key={`${key.id}-rotate`}
              submitLabel="轮换 Key"
              title={`Rotate ${key.label}`}
            />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {overview.routes.map((route) => (
            <AdminActionForm
              description={`调整 ${route.purpose} 的主模型和路由状态。`}
              endpoint={`/api/admin/model-routes/${route.id}`}
              fields={[
                {
                  name: "status",
                  label: "目标状态",
                  type: "select",
                  defaultValue: route.status,
                  options: [
                    { label: "active", value: "active" },
                    { label: "paused", value: "paused" },
                    { label: "exhausted", value: "exhausted" },
                    { label: "error", value: "error" },
                  ],
                },
                {
                  name: "primaryModel",
                  label: "主模型",
                  defaultValue: route.primaryModel,
                },
                {
                  name: "minMarginPercent",
                  label: "最小毛利率",
                  type: "number",
                  defaultValue: String(route.minMarginPercent),
                },
              ]}
              key={route.id}
              submitLabel="更新路由"
              title={`Route ${route.purpose}`}
            />
          ))}
        </div>

        <ProviderTable
          providers={overview.providers}
          keys={overview.keys}
          routes={overview.routes}
        />
      </div>
    </AdminShell>
  );
}
