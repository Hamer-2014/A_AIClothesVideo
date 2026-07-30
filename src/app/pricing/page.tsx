import { TrialCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { PurchaseButton } from "@/components/billing/purchase-button";
import { getServerSession } from "@/lib/auth/server";
import { creditPackages } from "@/lib/credits/packages";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { getCreemPurchaseReadiness } from "@/lib/providers/creem/config";
import {
  getVideoSpec,
  isVideoDurationEnabled,
  videoDurations,
} from "@/lib/video/specs";
import { recordFunnelEventSafely } from "@/server/analytics/funnel-events";

const packageVideoEstimates = {
  starter: "About one 8-second video",
  creator: "About two 16-second videos",
  studio: "About five 24-second videos",
} as const;

interface PricingPageProps {
  searchParams?: Promise<{ package?: string | string[] }>;
}

export default async function PricingPage({ searchParams }: PricingPageProps = {}) {
  const [session, resolvedSearchParams, locale] = await Promise.all([
    getServerSession(),
    searchParams ?? Promise.resolve<{ package?: string | string[] }>({}),
    getRequestLocale(),
  ]);
  const isChinese = locale === "zh-CN";
  const user = session?.user ?? null;
  const requestedPackage = resolvedSearchParams.package;
  const selectedPackageCode =
    user && typeof requestedPackage === "string"
      ? creditPackages.find((item) => item.code === requestedPackage)?.code
      : undefined;
  const purchasesEnabled = getCreemPurchaseReadiness().ready;
  const duration40Enabled = isVideoDurationEnabled(40, process.env);
  const availableDurations = videoDurations.filter(
    (duration) => duration !== 40 || duration40Enabled,
  );
  await recordFunnelEventSafely({
    eventName: "pricing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: localizeHref("/pricing", locale),
    metadata: { sourcePage: "pricing" },
  });

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader language={locale} sourcePage="pricing" user={user} />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
              {isChinese ? "点数包" : "Credit packs"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              {isChinese ? "先免费试用，再用点数生成 8、16 或 24 秒商品视频。" : "Start with one free trial, then use credits for 8, 16, or 24-second product videos."}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {isChinese ? "免费试用为 1 条 8 秒低清、无音频、带水印视频。付费视频提供高分辨率、无水印并默认含音频。生成前预留点数，只有质检通过且视频可交付后才会扣除。" : "Free trials use a low-resolution, watermarked 8-second video with no audio. Paid videos include high resolution, no watermark, and audio. Credits are reserved before generation and only captured after quality checks pass and a video can be delivered."}
            </p>
          </div>
          {user ? (
            <a
              className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
              href={localizeHref("/workspace", locale)}
            >
              {isChinese ? "进入工作台" : "Go to workspace"}
            </a>
          ) : (
            <TrialCtaLink locale={locale} sourcePage="pricing">{isChinese ? "免费生成 1 条试用视频" : "Create one free trial video"}</TrialCtaLink>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3" id="credit-packs">
          {creditPackages.map((item) => {
            const selected = item.code === selectedPackageCode;

            return (
              <article
                aria-label={isChinese ? `${item.name} 点数包` : `${item.name} credit pack`}
                className={`flex flex-col rounded-lg border p-5 ${
                  selected
                    ? "border-[var(--action)] bg-[var(--brand-soft)]"
                    : "border-[var(--line)] bg-white"
                }`}
                key={item.code}
              >
                <div className="flex min-h-6 items-start justify-between gap-3">
                  <h2 className="text-base font-medium">{item.name}</h2>
                  {selected ? (
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-[var(--action-hover)]">
                      {isChinese ? "已选择" : "Selected"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-semibold">
                  {`$${(item.amountCents / 100).toFixed(2)}`}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {item.credits} {isChinese ? "点数" : "credits"}
                </p>
                <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm font-medium">
                  {isChinese
                    ? item.code === "starter" ? "约 1 条 8 秒视频" : item.code === "creator" ? "约 2 条 16 秒视频" : "约 5 条 24 秒视频"
                    : packageVideoEstimates[item.code]}
                </p>
                <p className="mt-4 flex-1 text-sm leading-6 text-[var(--muted)]">
                  {isChinese
                    ? item.name === "Starter" ? "适合测试少量商品视频。" : item.name === "Creator" ? "适合制作多条商品视频。" : "适合为多个商品制作视频的团队。"
                    : item.name === "Starter"
                    ? "For testing a small number of product videos."
                    : item.name === "Creator"
                      ? "For producing several product videos."
                      : "For teams producing videos for multiple products."}
                </p>
                <PurchaseButton
                  authenticated={Boolean(user)}
                  language={locale}
                  packageCode={item.code}
                  packageName={item.name}
                  purchasesEnabled={purchasesEnabled}
                  selected={selected}
                />
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          {isChinese ? "估算基于当前点数成本。混合使用不同时长时，请以生成确认页显示的实际点数为准。" : "Estimates are based on current credit costs. When you mix video lengths, the confirmed generation screen shows the actual credits required."}
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-medium">{isChinese ? "视频点数成本" : "Video credit costs"}</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {availableDurations.map((duration) => {
                const spec = getVideoSpec(duration);
                return (
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4" key={duration}>
                    <p className="font-medium">
                      {duration === 40 ? (isChinese ? "40 秒 Beta" : "40-second Beta") : isChinese ? `${duration} 秒` : `${duration} seconds`}
                    </p>
                    <p className="mt-2 text-[var(--muted)]">
                      {spec.creditCost} {isChinese ? "点数" : "credits"} · {spec.segmentCount} {isChinese ? "个分段" : "segments"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-medium">{isChinese ? "免费试用" : "Free trial"}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {isChinese ? `新用户可生成 1 条 8 秒低清、无音频、带水印试用视频，仅使用低风险镜头。16 秒、24 秒${duration40Enabled ? "和 40 秒 Beta" : ""}视频及高分辨率交付需要点数。` : <>New users can create one free trial video: 8 seconds, low resolution, no audio, and a watermark. It only uses low-risk shots. 16- and 24-second videos{duration40Enabled ? ", plus the 40-second Beta," : ""} and paid high-resolution delivery require credits.</>}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">{isChinese ? "点数预留与交付" : "Credit reservation and delivery"}</h2>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-[var(--muted)] md:grid-cols-3">
            <p>{isChinese ? "生成前会预留点数，点击确认不会立即扣除。" : "Credits are reserved before generation. A click does not immediately consume them."}</p>
            <p>{isChinese ? "若生成失败、未创建或无法交付，点数会按任务状态释放或退回。" : "If a generation fails, is not created, or cannot be delivered, credits will be released or returned according to its status."}</p>
            <p>{isChinese ? "只有质检通过且可交付后才会正式扣除点数。" : "Credits are only captured after quality checks pass and delivery is available."}</p>
          </div>
        </div>
      </section>
      <PublicFooter language={locale} />
    </main>
  );
}
