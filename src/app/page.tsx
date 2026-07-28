import type { Metadata } from "next";
import { ArrowDown, ArrowRight, Check } from "lucide-react";

import { TrialCtaLink, WorkspaceCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { SampleVideo } from "@/components/public/sample-video";
import { ThreeImageStrip } from "@/components/public/three-image-strip";
import { TrackedMarketingLink } from "@/components/public/tracked-marketing-link";
import { getServerSession } from "@/lib/auth/server";
import { recordFunnelEventSafely } from "@/server/analytics/funnel-events";

export const metadata: Metadata = {
  title: "AI Clothes Video｜三张服装图生成商品宣传视频",
  description:
    "上传同一件服装的三张素材图，系统检查素材边界、自动推荐可用镜头，生成 8、16 或 24 秒商品宣传视频。新用户可免费试用 1 条 8 秒视频。",
};

const controlSteps = [
  ["01", "上传前确认同款", "请确认三张素材来自同一件服装。系统检查素材角色与可用边界；细节图是否属于同一件服装仍需由你确认。"],
  ["02", "判断素材边界", "识别正面、背面、侧面和细节，明确哪些镜头有真实依据。"],
  ["03", "选择安全镜头", "先过滤不可用镜头，再按风格预设推荐；缺少依据的镜头保持不可用。"],
  ["04", "生成后质检", "对成片抽帧检查并记录任务状态，通过后再提供预览与下载。"],
] as const;

const presets = [
  ["极简棚拍", "干净背景，突出服装版型，适合独立站商品页。", "默认试用风格，优先稳定镜头"],
  ["电商主图动效", "让白底图或平铺图产生克制运动，适合商品主图。", "只强化可见轮廓与细节"],
  ["社媒氛围短片", "为 TikTok / Reels 测款提供轻氛围表达。", "没有场景或模特素材时不生成强场景与模特动作"],
] as const;

export default async function Home() {
  const session = await getServerSession();
  const user = session?.user ?? null;

  await recordFunnelEventSafely({
    eventName: "landing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: "/",
    metadata: { sourcePage: "homepage" },
  });

  const primaryCta = (position: string) =>
    user ? (
      <WorkspaceCtaLink ctaPosition={position} sourcePage="homepage">
        进入工作台
      </WorkspaceCtaLink>
    ) : (
      <TrialCtaLink ctaPosition={position} sourcePage="homepage">
        免费生成 1 条试用视频
      </TrialCtaLink>
    );

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <PublicHeader language="zh-CN" sourcePage="homepage" user={user} />

      <section className="landing-hero" aria-labelledby="landing-title">
        <SampleVideo
          autoPlay
          className="landing-hero-video"
          sourcePage="homepage"
          testId="landing-hero-video"
        />
        <div aria-hidden="true" className="landing-hero-shade" />
        <div className="relative z-10 mx-auto flex min-h-[inherit] w-full max-w-7xl items-end px-5 pb-20 pt-16 sm:px-8 lg:items-center lg:px-12 lg:py-16">
          <div className="landing-hero-copy max-w-2xl text-white">
            <p className="text-sm font-semibold text-white/75">为跨境服装卖家制作商品短视频</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] sm:text-6xl lg:text-7xl" id="landing-title">
              三张服装图，生成一条商品宣传视频
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/88 sm:text-lg sm:leading-8">
              上传同一件服装的正面、背面与细节图。系统先检查素材，再匹配可用镜头，生成适合商品页和社媒测款的 8、16 或 24 秒视频。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryCta("hero")}
              <a className="inline-flex min-h-11 items-center justify-center border border-white/50 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10" href="#source-proof">
                查看真实三图样例
              </a>
            </div>
            {!user ? (
              <p className="mt-4 text-sm leading-6 text-white/72">8 秒 · 低清 · 无音频 · 带水印 · 仅低风险镜头</p>
            ) : null}
            <p className="mt-5 flex max-w-xl items-start gap-2 text-sm leading-6 text-white/82">
              <Check aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-light)]" size={17} />
              没有背面图，不生成背面；没有细节图，不编造细节。
            </p>
          </div>
        </div>
        <a aria-label="查看三张真实输入素材" className="absolute bottom-5 right-5 z-10 inline-flex size-11 items-center justify-center border border-white/40 text-white transition-colors hover:bg-white/10 sm:right-8" href="#source-proof">
          <ArrowDown aria-hidden="true" size={18} />
        </a>
      </section>

      <section className="bg-[var(--surface-raised)]" id="source-proof">
        <div className="mx-auto max-w-7xl px-5 py-18 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-end">
            <div className="max-w-md">
              <p className="section-kicker">01 / 同一件服装，三张素材</p>
              <h2 className="section-title">每张图都决定视频能展示什么</h2>
              <p className="section-copy">正面图确定整体轮廓，背面图支持背部展示，细节图支持面料或工艺特写。素材缺失时，系统会收窄镜头，而不是补画不存在的结构。</p>
            </div>
            <ThreeImageStrip />
          </div>
          <div className="mt-12 grid gap-7 border-t border-[var(--line-strong)] pt-8 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <p className="text-sm font-semibold">由以上三张素材生成的真实样例</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">样例展示真实工作流结果，不代表所有服装都会得到完全相同的动作、画面或生成时长。</p>
            </div>
            <div className="relative aspect-video overflow-hidden bg-black">
              <SampleVideo className="size-full object-cover" controls sourcePage="homepage" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker text-[var(--brand-light)]">02 / 稳定来自约束</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-end">
            <h2 className="text-3xl font-semibold leading-tight sm:text-5xl">不让 AI 自由发挥服装细节</h2>
            <p className="max-w-lg text-base leading-7 text-white/68 lg:justify-self-end">我们把容易翻车的地方放进生成前后的规则里。稳定指检查、限制和质检，不是结果保证。</p>
          </div>
          <ol className="mt-14 grid border-y border-white/20 md:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/20">
            {controlSteps.map(([number, title, body]) => (
              <li className="border-b border-white/20 py-7 last:border-b-0 md:px-6 md:nth-[2n]:border-l lg:border-b-0 lg:first:pl-0 lg:last:pr-0" key={number}>
                <p className="text-xs text-white/45">{number}</p>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{body}</p>
              </li>
            ))}
          </ol>
          <TrackedMarketingLink className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-[var(--brand-light)]" destination="/three-images-to-clothing-video" sourcePage="homepage">
            了解三张图如何影响镜头选择 <ArrowRight aria-hidden="true" size={16} />
          </TrackedMarketingLink>
        </div>
      </section>

      <section className="bg-[var(--background)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">03 / 选择用途，不用研究提示词</p>
          <h2 className="section-title max-w-3xl">告诉系统你准备把视频用在哪里</h2>
          <div className="mt-12 grid border-y border-[var(--line-strong)] md:grid-cols-3 md:divide-x md:divide-[var(--line-strong)]">
            {presets.map(([name, description, boundary]) => (
              <article className="border-b border-[var(--line)] py-7 last:border-b-0 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0" key={name}>
                <h3 className="text-xl font-semibold">{name}</h3>
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{description}</p>
                <p className="mt-7 border-l-2 border-[var(--brand)] pl-3 text-xs leading-5 text-[var(--muted)]">{boundary}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6 text-[var(--muted)]">风格只改变镜头推荐顺序和画面基调，不能绕过素材限制。</p>
        </div>
      </section>

      <section className="bg-[var(--surface-subtle)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-12 lg:py-28">
          <div>
            <p className="section-kicker">04 / 可发布的完整视频</p>
            <h2 className="section-title">为一个 SKU 生成 8、16 或 24 秒成片</h2>
            <p className="section-copy">系统根据时长组合 1、2 或 3 个 8 秒镜头，在后台完成生成、拼接和质检。你看到的是一条完整任务，以及清晰的预览、进度和下载状态。</p>
            <TrackedMarketingLink className="mt-7 inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--brand)]" destination="/pricing" sourcePage="homepage">
              查看试用与点数价格 <ArrowRight aria-hidden="true" size={16} />
            </TrackedMarketingLink>
          </div>
          <dl className="border-y border-[var(--line-strong)]">
            {[["8 秒", "1 个镜头，适合快速试款"], ["16 秒", "2 个镜头，适合常规商品介绍"], ["24 秒", "3 个镜头，适合展示整体、背面与可见细节"], ["常用比例", "9:16 / 1:1 / 16:9"]].map(([term, detail]) => (
              <div className="grid grid-cols-[5rem_1fr] gap-5 border-b border-[var(--line)] py-5 last:border-b-0 sm:grid-cols-[7rem_1fr]" key={term}>
                <dt className="font-semibold">{term}</dt><dd className="text-sm leading-6 text-[var(--muted)]">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-white/75">先从一个 SKU 开始</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">用现有商品图，生成第一条服装视频</h2>
            <p className="mt-4 text-sm leading-6 text-white/80">准备同一件服装的三张清晰素材，剩下的镜头判断、分镜和质检交给系统。</p>
          </div>
          <div className="flex flex-col items-start gap-4">
            {primaryCta("final")}
            <TrackedMarketingLink className="text-sm font-semibold text-white/85 hover:text-white" destination="/faq" sourcePage="homepage">还不确定该上传什么？查看素材要求</TrackedMarketingLink>
          </div>
        </div>
      </section>

      <PublicFooter language="zh-CN" />
    </main>
  );
}
