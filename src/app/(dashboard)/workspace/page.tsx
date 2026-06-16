import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/shell";
import { WorkspaceApp } from "@/components/workspace/workspace-app";
import {
  buildLoginHrefForRedirect,
  buildRelativePathWithQuery,
} from "@/lib/auth/redirects";
import { getServerSession } from "@/lib/auth/server";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import { buildDashboardNav } from "@/app/app-shell";
import {
  createDrizzleUserBillingStore,
  getUserBillingOverview,
} from "@/server/billing/user-billing";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{
    mode?: string;
    preset?: string;
  }>;
}) {
  const session = await getServerSession();
  const resolvedSearchParams = await searchParams;
  if (!session?.user?.id) {
    redirect(
      buildLoginHrefForRedirect(
        buildRelativePathWithQuery("/workspace", resolvedSearchParams),
      ),
    );
  }
  const initialMode = resolvedSearchParams?.mode === "trial" ? "trial" : "paid";
  const overview = await getUserBillingOverview({
    store: createDrizzleUserBillingStore(),
    userId: session.user.id,
  });

  return (
    <DashboardShell
      title="生成工作台"
      subtitle="上传素材、分析模板、确认分镜，再进入真实生成链路。"
      nav={buildDashboardNav("/workspace")}
      user={session.user}
      billing={overview.wallet}
    >
      <WorkspaceApp
        initialMode={initialMode}
        initialPresetId={resolvedSearchParams?.preset ?? null}
        templateCatalog={mvpShotTemplates}
      />
    </DashboardShell>
  );
}
