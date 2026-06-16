import { TrialCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { creditPackages } from "@/lib/credits/packages";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">价格</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          MVP 使用免费试用 + 点数包。付费生成默认高清无水印并包含音频。
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {creditPackages.map((item) => (
            <div className="rounded-lg border border-[var(--line)] bg-white p-5" key={item.code}>
              <h2 className="text-base font-medium">{item.name}</h2>
              <p className="mt-3 text-3xl font-semibold">
                ${(item.amountCents / 100).toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.credits} 点</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">生成消耗</h2>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <p>8 秒：70 点</p>
            <p>16 秒：130 点</p>
            <p>24 秒：190 点</p>
          </div>
        </div>
        <div className="mt-8">
          <TrialCtaLink />
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
