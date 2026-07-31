import { redirect } from "next/navigation";

import { buildDashboardNav } from "@/app/app-shell";
import { DashboardShell } from "@/components/dashboard/shell";
import { VirtualTryOnCreateForm } from "@/components/virtual-try-on/create-form";
import { buildLoginHrefForRedirect } from "@/lib/auth/redirects";
import { getServerSession } from "@/lib/auth/server";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { createDrizzleUserBillingStore, getUserBillingOverview } from "@/server/billing/user-billing";

export const dynamic = "force-dynamic";

export default async function VirtualTryOnPage() {
  const [session, locale] = await Promise.all([getServerSession(), getRequestLocale()]);
  const currentHref = localizeHref("/virtual-try-on", locale);
  if (!session?.user?.id) {
    redirect(localizeHref(buildLoginHrefForRedirect(currentHref), locale));
  }
  const overview = await getUserBillingOverview({
    store: createDrizzleUserBillingStore(),
    userId: session.user.id,
  });
  const isEnglish = locale === "en";

  return (
    <DashboardShell
      billing={overview.wallet}
      language={locale}
      nav={buildDashboardNav(currentHref, locale)}
      subtitle={isEnglish ? "Upload product images you can verify, then create a controlled static appearance pack." : "上传可验证的商品素材，创建受严格质检约束的静态模特定妆图。"}
      title={isEnglish ? "Virtual try-on" : "虚拟试穿"}
      user={session.user}
    >
      <VirtualTryOnCreateForm language={locale} />
    </DashboardShell>
  );
}
