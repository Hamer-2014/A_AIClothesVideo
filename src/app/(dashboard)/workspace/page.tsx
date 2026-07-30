import { DashboardShell } from "@/components/dashboard/shell";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { WorkspaceApp } from "@/components/workspace/workspace-app";
import {
  buildLoginHrefForRedirect,
  buildRelativePathWithQuery,
} from "@/lib/auth/redirects";
import { getServerSession } from "@/lib/auth/server";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import { isVideoDurationEnabled } from "@/lib/video/specs";
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
  const [session, resolvedSearchParams, locale] = await Promise.all([
    getServerSession(),
    searchParams,
    getRequestLocale(),
  ]);
  const isChinese = locale === "zh-CN";
  const initialMode = resolvedSearchParams?.mode === "trial" ? "trial" : "paid";
  const duration40Enabled = isVideoDurationEnabled(40, process.env);
  if (!session?.user?.id) {
    const loginHref = localizeHref(buildLoginHrefForRedirect(
      buildRelativePathWithQuery(localizeHref("/workspace", locale), {
        ...resolvedSearchParams,
        resumeDraft: "1",
      }),
    ), locale);

    return (
      <div className="min-h-svh bg-[var(--surface)] text-[var(--ink)]">
        <PublicHeader language={locale} user={session?.user ?? null} />
        <main>
          <section className="border-b border-[var(--line)] bg-white">
            <div
              className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8"
              data-testid="guest-workspace-intro"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--brand)]">
                  {isChinese ? "免登录配置" : "Configure before signing in"}
                </p>
                <h1 className="mt-1 text-lg font-semibold sm:text-xl">
                  {isChinese ? "服装视频工作台" : "Clothing video workspace"}
                </h1>
                <p className="mt-1 hidden max-w-3xl text-sm leading-6 text-[var(--muted)] sm:block">
                  {isChinese
                    ? "先配置规格并本地预览素材，点击生成时再登录并正式上传。"
                    : "Set the output and preview your materials locally. Sign in only when you are ready to upload and generate."}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ink)] px-4 text-sm font-medium text-white"
                  href={loginHref}
                >
                  {isChinese ? "登录后继续生成" : "Sign in to generate"}
                </a>
                <a
                  className="hidden h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm font-medium sm:inline-flex"
                  href={localizeHref("/pricing", locale)}
                >
                  {isChinese ? "查看价格" : "View pricing"}
                </a>
              </div>
            </div>
          </section>
          <section className="px-4 py-3 sm:px-6 sm:py-5 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <WorkspaceApp
                duration40Enabled={duration40Enabled}
                initialMode={initialMode}
                initialPresetId={resolvedSearchParams?.preset ?? null}
                isAuthenticated={false}
                language={locale}
                loginHref={loginHref}
                templateCatalog={mvpShotTemplates}
              />
            </div>
          </section>
        </main>
        <PublicFooter language={locale} />
      </div>
    );
  }
  const overview = await getUserBillingOverview({
    store: createDrizzleUserBillingStore(),
    userId: session.user.id,
  });

  return (
    <DashboardShell
      language={locale}
      title={isChinese ? "生成工作台" : "Video workspace"}
      subtitle={isChinese
        ? "上传素材、分析模板、确认分镜，再进入真实生成链路。"
        : "Upload materials, review the shot plan, and submit a controlled clothing-video generation."}
      nav={buildDashboardNav(localizeHref("/workspace", locale), locale)}
      user={session.user}
      billing={overview.wallet}
    >
      <WorkspaceApp
        duration40Enabled={duration40Enabled}
        initialMode={initialMode}
        initialPresetId={resolvedSearchParams?.preset ?? null}
        isAuthenticated
        language={locale}
        templateCatalog={mvpShotTemplates}
      />
    </DashboardShell>
  );
}
