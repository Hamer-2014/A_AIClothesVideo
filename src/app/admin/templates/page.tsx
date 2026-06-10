import { redirect } from "next/navigation";

import { buildAdminNav, buildTemplateStatusRows } from "@/app/app-shell";
import { AdminActionForm } from "@/components/admin/action-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { TemplateStatusTable } from "@/components/admin/template-status-table";
import { getAdminSession } from "@/server/auth/admin-session";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import {
  createDrizzleTemplateListStore,
  listStoredTemplates,
} from "@/server/templates/list";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const admin = await getAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const storedTemplates = await listStoredTemplates({
    store: createDrizzleTemplateListStore(),
  });
  const templates = buildTemplateStatusRows(mvpShotTemplates, storedTemplates);

  return (
    <AdminShell
      title="模板状态"
      subtitle="模板是规则资产，不是前端写死按钮。这里优先看状态、版本、风险和试用权限。"
      nav={buildAdminNav("/admin/templates")}
    >
      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          {templates.map((template) => (
            <AdminActionForm
              description={`更新模板 ${template.displayName} 的状态，后台会保留版本信息。`}
              endpoint="/api/admin/templates/status"
              fields={[
                {
                  name: "templateId",
                  label: "模板 ID",
                  defaultValue: template.templateId,
                },
                {
                  name: "version",
                  label: "版本",
                  type: "number",
                  defaultValue: String(template.version),
                },
                {
                  name: "status",
                  label: "目标状态",
                  type: "select",
                  defaultValue: template.status,
                  options: [
                    { label: "draft", value: "draft" },
                    { label: "beta", value: "beta" },
                    { label: "active", value: "active" },
                    { label: "paused", value: "paused" },
                  ],
                },
              ]}
              key={`${template.templateId}-${template.version}`}
              submitLabel="更新模板状态"
              title={template.displayName}
            />
          ))}
        </div>

        <TemplateStatusTable templates={templates} />
      </div>
    </AdminShell>
  );
}
