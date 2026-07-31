import { notFound, redirect } from "next/navigation";

import { buildDashboardNav } from "@/app/app-shell";
import { DashboardShell } from "@/components/dashboard/shell";
import { VirtualTryOnPackDetail } from "@/components/virtual-try-on/pack-detail";
import { buildLoginHrefForRedirect } from "@/lib/auth/redirects";
import { getServerSession } from "@/lib/auth/server";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { createDrizzleUserBillingStore, getUserBillingOverview } from "@/server/billing/user-billing";
import { createDrizzleVirtualTryOnOwnerStore, getVirtualTryOnDetail } from "@/server/virtual-tryon/owner";

export const dynamic = "force-dynamic";

export default async function VirtualTryOnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session, locale] = await Promise.all([params, getServerSession(), getRequestLocale()]);
  const currentHref = localizeHref(`/virtual-try-on/${id}`, locale);
  if (!session?.user?.id) redirect(localizeHref(buildLoginHrefForRedirect(currentHref), locale));

  const [overview, detail] = await Promise.all([
    getUserBillingOverview({ store: createDrizzleUserBillingStore(), userId: session.user.id }),
    getVirtualTryOnDetail({ userId: session.user.id, jobId: id }, createDrizzleVirtualTryOnOwnerStore()),
  ]);
  if (!detail) notFound();
  const isEnglish = locale === "en";

  return <DashboardShell billing={overview.wallet} language={locale} nav={buildDashboardNav(currentHref, locale)} subtitle={isEnglish ? "Review verified appearance-pack delivery, then lock or download it." : "查看经过严格核验的定妆图交付结果，再锁定或下载。"} title={isEnglish ? "Virtual try-on" : "虚拟试穿"} user={session.user}>
    <VirtualTryOnPackDetail initialDetail={detail} language={locale} />
  </DashboardShell>;
}
