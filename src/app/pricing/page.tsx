import { TrialCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { PurchaseButton } from "@/components/billing/purchase-button";
import { getServerSession } from "@/lib/auth/server";
import { creditPackages } from "@/lib/credits/packages";
import { isCreemPurchasesEnabled } from "@/lib/providers/creem/config";
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

export default async function PricingPage() {
  const session = await getServerSession();
  const user = session?.user ?? null;
  const purchasesEnabled = isCreemPurchasesEnabled();
  const duration40Enabled = isVideoDurationEnabled(40, process.env);
  const availableDurations = videoDurations.filter(
    (duration) => duration !== 40 || duration40Enabled,
  );
  await recordFunnelEventSafely({
    eventName: "pricing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: "/pricing",
    metadata: { sourcePage: "pricing" },
  });

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={user} />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
              Credit packs
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Start with one free trial, then use credits for 8, 16, or 24-second product videos.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Free trials use a low-resolution, watermarked 8-second video with no audio. Paid videos include high resolution, no watermark, and audio. Credits are reserved before generation and only captured after quality checks pass and a video can be delivered.
            </p>
          </div>
          {user ? (
            <a
              className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
              href="/workspace"
            >
              Go to workspace
            </a>
          ) : (
            <TrialCtaLink sourcePage="pricing">Create one free trial video</TrialCtaLink>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3" id="credit-packs">
          {creditPackages.map((item) => (
            <div className="flex flex-col rounded-lg border border-[var(--line)] bg-white p-5" key={item.code}>
              <h2 className="text-base font-medium">{item.name}</h2>
              <p className="mt-3 text-3xl font-semibold">
                {`$${(item.amountCents / 100).toFixed(2)}`}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.credits} credits</p>
              <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm font-medium">
                {packageVideoEstimates[item.code]}
              </p>
              <p className="mt-4 flex-1 text-sm leading-6 text-[var(--muted)]">
                {item.name === "Starter"
                  ? "For testing a small number of product videos."
                  : item.name === "Creator"
                    ? "For producing several product videos."
                    : "For teams producing videos for multiple products."}
              </p>
              <PurchaseButton
                authenticated={Boolean(user)}
                packageCode={item.code}
                packageName={item.name}
                purchasesEnabled={purchasesEnabled}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          Estimates are based on current credit costs. When you mix video lengths, the confirmed generation screen shows the actual credits required.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-medium">Video credit costs</h2>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {availableDurations.map((duration) => {
                const spec = getVideoSpec(duration);
                return (
                  <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4" key={duration}>
                    <p className="font-medium">
                      {duration === 40 ? "40-second Beta" : `${duration} seconds`}
                    </p>
                    <p className="mt-2 text-[var(--muted)]">
                      {spec.creditCost} credits · {spec.segmentCount} segments
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-medium">Free trial</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              New users can create one free trial video: 8 seconds, low resolution, no audio, and a watermark. It only uses low-risk shots. 16- and 24-second videos{duration40Enabled ? ", plus the 40-second Beta," : ""} and paid high-resolution delivery require credits.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">Credit reservation and delivery</h2>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-[var(--muted)] md:grid-cols-3">
            <p>Credits are reserved before generation. A click does not immediately consume them.</p>
            <p>If a generation fails, is not created, or cannot be delivered, credits will be released or returned according to its status.</p>
            <p>Credits are only captured after quality checks pass and delivery is available.</p>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
