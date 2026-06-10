import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/shell";
import { WorkspaceApp } from "@/components/workspace/workspace-app";
import { getServerSession } from "@/lib/auth/server";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import { buildDashboardNav } from "@/app/app-shell";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <DashboardShell
      title="生成工作台"
      subtitle="上传素材、分析模板、确认分镜，再进入真实生成链路。"
      nav={buildDashboardNav("/workspace")}
    >
      <WorkspaceApp templateCatalog={mvpShotTemplates} />
    </DashboardShell>
  );
}
