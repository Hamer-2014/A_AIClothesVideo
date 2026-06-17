import { TrialCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { creditPackages } from "@/lib/credits/packages";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
              点数包
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              先免费试 1 条，再按视频规格消耗点数
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              免费试用用于验证素材和效果；付费生成默认高分辨率、无水印、包含音频。
              点数在确认生成后冻结，质检通过并交付后才正式扣除。
            </p>
          </div>
          <TrialCtaLink />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {creditPackages.map((item) => (
            <div className="rounded-lg border border-[var(--line)] bg-white p-5" key={item.code}>
              <h2 className="text-base font-medium">{item.name}</h2>
              <p className="mt-3 text-3xl font-semibold">
                ${(item.amountCents / 100).toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.credits} 点</p>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                适合{item.name === "Starter" ? "先跑少量 SKU 验证效果" : item.name === "Creator" ? "连续生成多条商品短视频" : "小团队集中制作多款商品素材"}。
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-medium">生成消耗</h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
                <p className="font-medium">8 秒</p>
                <p className="mt-2 text-[var(--muted)]">70 点 · 1 个片段</p>
              </div>
              <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
                <p className="font-medium">16 秒</p>
                <p className="mt-2 text-[var(--muted)]">130 点 · 2 个片段</p>
              </div>
              <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
                <p className="font-medium">24 秒</p>
                <p className="mt-2 text-[var(--muted)]">190 点 · 3 个片段</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-base font-medium">免费试用</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              新用户可免费生成 1 条试用视频：8 秒、低分辨率、无音频、带水印，
              仅开放低风险镜头。16/24 秒和高清无水印需要使用点数。
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">失败与退款规则</h2>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-[var(--muted)] md:grid-cols-3">
            <p>生成前会先冻结点数，不会一点击就正式扣除。</p>
            <p>供应商失败、未生成或无法交付时，失败会释放或退回点数。</p>
            <p>质量检查未通过且无法交付时，会按任务状态处理退款或释放。</p>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
