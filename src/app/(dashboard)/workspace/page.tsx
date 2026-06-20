import { DashboardShell } from "@/components/dashboard/shell";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
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
  const initialMode = resolvedSearchParams?.mode === "trial" ? "trial" : "paid";
  if (!session?.user?.id) {
    const loginHref = buildLoginHrefForRedirect(
      buildRelativePathWithQuery("/workspace", {
        ...resolvedSearchParams,
        resumeDraft: "1",
      }),
    );

    return (
      <div className="min-h-svh bg-[var(--surface)] text-[var(--ink)]">
        <PublicHeader />
        <main>
          <section className="border-b border-[var(--line)] bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-5 px-4 py-6 sm:px-6 lg:px-8">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
                  免登录先配置
                </p>
                <h1 className="mt-3 text-2xl font-semibold tracking-normal md:text-3xl">
                  先试做一条服装短视频，再登录生成
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  可以先选择风格、规格、提示词并本地预览素材。点击生成时再登录；
                  为了保护素材和计费链路，登录后需要重新选择图片并正式上传。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--ink)] px-5 text-sm font-medium text-white"
                  href={loginHref}
                >
                  登录后继续生成
                </a>
                <a
                  className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--line)] bg-white px-5 text-sm font-medium"
                  href="/pricing"
                >
                  查看价格
                </a>
              </div>
            </div>
          </section>
          <section className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <WorkspaceApp
                initialMode={initialMode}
                initialPresetId={resolvedSearchParams?.preset ?? null}
                isAuthenticated={false}
                loginHref={loginHref}
                templateCatalog={mvpShotTemplates}
              />
            </div>
          </section>
        </main>
        <PublicFooter />
      </div>
    );
  }
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
        isAuthenticated
        templateCatalog={mvpShotTemplates}
      />
    </DashboardShell>
  );
}
