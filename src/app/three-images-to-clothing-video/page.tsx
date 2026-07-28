import type { Metadata } from "next";
import { ArrowDown, ArrowRight, Check, X } from "lucide-react";

import { TrialCtaLink, WorkspaceCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { SampleVideo } from "@/components/public/sample-video";
import { ThreeImageStrip } from "@/components/public/three-image-strip";
import { TrackedMarketingLink } from "@/components/public/tracked-marketing-link";
import { getServerSession } from "@/lib/auth/server";
import { recordFunnelEventSafely } from "@/server/analytics/funnel-events";

export const metadata: Metadata = {
  title: "三张服装图片生成视频｜AI Clothes Video",
  description:
    "用正面、背面和细节图生成更可控的服装商品视频。系统先检查素材角色与可用边界，再选择安全镜头并完成生成后质检。",
  alternates: { canonical: "/three-images-to-clothing-video" },
};

const protocols = [
  {
    label: "推荐",
    title: "三图商品展示",
    formula: "正面主图 + 背面图 + 细节图",
    body: "适合大多数服装 SKU，用于商品页和常规社媒展示。",
  },
  {
    label: "付费 Beta",
    title: "商品旋转（付费 Beta）",
    formula: "无真人商品正面 + 侧面 + 背面",
    body: "仅在三张同款一致性通过后开放；不会被风格预设自动选中。",
  },
  {
    label: "付费 Beta",
    title: "真人模特转身（付费 Beta）",
    formula: "同一模特、同一件服装的正面 + 侧面 + 背面",
    body: "服装和任务内可见模特均需通过一致性检查，并要求上传者拥有肖像与商业宣传授权。",
  },
] as const;

const controls = [
  ["01", "上传定位", "每张图进入明确位置，不让系统猜它是正面、背面还是细节。"],
  ["02", "同款责任与检查", "请确认三张图属于同一 SKU；主体视角使用任务内一致性检查，细节图仍需由你确认同款。"],
  ["03", "镜头权限", "先过滤不可用镜头，再让风格预设参与推荐；提示词不能越权。"],
  ["04", "成片质检", "分段生成后抽帧检查，拼接为完整视频并记录交付状态。"],
] as const;

export default async function ThreeImagesLandingPage() {
  const session = await getServerSession();
  const user = session?.user ?? null;

  await recordFunnelEventSafely({
    eventName: "landing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: "/three-images-to-clothing-video",
    metadata: { sourcePage: "three_images_landing" },
  });

  const primaryCta = (position: string) =>
    user ? (
      <WorkspaceCtaLink ctaPosition={position} sourcePage="three_images_landing">
        进入工作台
      </WorkspaceCtaLink>
    ) : (
      <TrialCtaLink ctaPosition={position} sourcePage="three_images_landing">
        用三张图开始生成
      </TrialCtaLink>
    );

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <PublicHeader language="zh-CN" sourcePage="three_images_landing" user={user} />

      <section className="landing-hero landing-hero-topic" aria-labelledby="three-images-title">
        <SampleVideo autoPlay className="landing-hero-video" sourcePage="three_images_landing" />
        <div aria-hidden="true" className="landing-hero-shade" />
        <div className="relative z-10 mx-auto flex min-h-[inherit] w-full max-w-7xl items-end px-5 pb-20 pt-16 sm:px-8 lg:items-center lg:px-12 lg:py-16">
          <div className="landing-hero-copy max-w-2xl text-white">
            <p className="text-sm font-semibold text-white/75">AI Clothes Video · 三图生成协议</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] sm:text-6xl lg:text-7xl" id="three-images-title">
              用三张同款服装图，生成更可控的商品视频
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/88 sm:text-lg sm:leading-8">
              不是把三张图随便丢给模型。系统会先识别每张图提供的服装证据，再只开放有素材支持的镜头。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryCta("hero")}
              <a className="inline-flex min-h-11 items-center justify-center border border-white/50 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10" href="#real-process">
                先看真实生成过程
              </a>
            </div>
            {!user ? <p className="mt-4 text-sm leading-6 text-white/72">首次试用可生成 1 条 8 秒低清、无音频、水印视频，仅开放低风险镜头。</p> : null}
          </div>
        </div>
        <a aria-label="查看三图协议" className="absolute bottom-5 right-5 z-10 inline-flex size-11 items-center justify-center border border-white/40 text-white transition-colors hover:bg-white/10 sm:right-8" href="#why-three">
          <ArrowDown aria-hidden="true" size={18} />
        </a>
      </section>

      <section className="bg-[var(--surface-raised)]" id="why-three">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="section-kicker">01 / 为什么是三张图</p>
              <h2 className="section-title">一张图告诉模型“是什么”，三张图告诉系统“能展示到哪里”</h2>
            </div>
            <p className="section-copy lg:max-w-xl lg:justify-self-end">服装视频最容易出问题的不是运动不够大，而是背面、版型和细节被擅自补全。请先确认三张素材属于同一 SKU，再让每个镜头使用对应的真实依据。</p>
          </div>
          <div className="mt-12 overflow-x-auto border-y border-[var(--line-strong)]">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead><tr className="text-sm"><th className="w-1/4 py-4 pr-6 font-semibold">素材</th><th className="w-2/5 py-4 pr-6 font-semibold">能支持的内容</th><th className="py-4 font-semibold">不能自动推断</th></tr></thead>
              <tbody className="text-sm leading-6 text-[var(--muted)]">
                <tr className="border-t border-[var(--line)]"><th className="py-5 pr-6 font-semibold text-[var(--ink)]">正面主图</th><td className="py-5 pr-6">正面轮廓、可见图案、慢推或平移</td><td className="py-5">背面结构、隐藏开衩、背部印花</td></tr>
                <tr className="border-t border-[var(--line)]"><th className="py-5 pr-6 font-semibold text-[var(--ink)]">背面或侧面图</th><td className="py-5 pr-6">对应视角的真实结构</td><td className="py-5">未上传角度之间的连续旋转</td></tr>
                <tr className="border-t border-[var(--line)]"><th className="py-5 pr-6 font-semibold text-[var(--ink)]">细节图</th><td className="py-5 pr-6">已拍到的面料、领口、袖口或印花</td><td className="py-5">未拍到的材质纹理和工艺</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-[var(--background)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">02 / 按位置上传</p>
          <h2 className="section-title">先选择三图方式，再准备对应素材</h2>
          <div className="mt-12 border-y border-[var(--line-strong)]">
            {protocols.map((protocol, index) => (
              <article className="grid gap-5 border-b border-[var(--line)] py-7 last:border-b-0 md:grid-cols-[4rem_1fr_1.25fr] md:items-start md:gap-8" key={protocol.title}>
                <p className="text-xs text-[var(--muted)]">0{index + 1}</p>
                <div><p className="text-xs font-semibold text-[var(--brand)]">{protocol.label}</p><h3 className="mt-2 text-xl font-semibold">{protocol.title}</h3></div>
                <div><p className="font-semibold">{protocol.formula}</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{protocol.body}</p></div>
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-6 text-[var(--muted)]">Beta 方案不是默认能力。素材不满足时，系统会要求补图或改用低风险展示，不会硬生成旋转和转身。</p>
        </div>
      </section>

      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div><p className="section-kicker text-[var(--brand-light)]">03 / 四道稳定控制</p><h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">从上传到交付，每一步都收窄不确定性</h2></div>
            <p className="max-w-lg text-lg leading-8 text-white/72 lg:justify-self-end">稳定不是让模型更大胆，而是让它少做没有证据的决定。</p>
          </div>
          <ol className="mt-14 grid border-y border-white/20 md:grid-cols-2">
            {controls.map(([number, title, body]) => (
              <li className="grid grid-cols-[3rem_1fr] gap-4 border-b border-white/20 py-7 md:px-7 md:nth-last-[-n+2]:border-b-0 md:odd:border-r" key={number}>
                <span className="text-xs text-white/45">{number}</span><div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{body}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[var(--surface-raised)]" id="real-process">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">04 / 真实案例</p>
          <h2 className="section-title">看三张原图如何变成一条完整视频</h2>
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <ThreeImageStrip compact />
            <div className="lg:sticky lg:top-6">
              <div className="relative aspect-[9/16] max-h-[720px] overflow-hidden bg-black">
                <SampleVideo className="size-full object-cover" controls sourcePage="three_images_landing" />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-5 border-y border-[var(--line-strong)] text-sm">
                <div className="py-4"><dt className="text-[var(--muted)]">使用风格</dt><dd className="mt-1 font-semibold">极简棚拍</dd></div>
                <div className="py-4"><dt className="text-[var(--muted)]">成片状态</dt><dd className="mt-1 font-semibold text-[var(--success)]">真实工作流样例</dd></div>
              </dl>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">这是一次真实工作流结果。不同服装、素材质量和镜头组合会产生不同结果。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--surface-subtle)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">05 / 先判断素材</p><h2 className="section-title">哪些素材适合，哪些要求应该停下来</h2>
          <div className="mt-12 grid gap-px overflow-hidden bg-[var(--line-strong)] md:grid-cols-2">
            <div className="bg-[var(--surface-raised)] p-6 sm:p-8"><h3 className="flex items-center gap-2 text-xl font-semibold"><Check aria-hidden="true" className="text-[var(--success)]" size={20} />适合</h3><ul className="mt-6 space-y-4 text-sm leading-6 text-[var(--muted)]"><li>同一 SKU 有三张清晰、主体完整的商品图。</li><li>需要快速制作商品页或社媒测款视频。</li><li>接受系统根据素材边界调整镜头。</li></ul></div>
            <div className="bg-[var(--surface-raised)] p-6 sm:p-8"><h3 className="flex items-center gap-2 text-xl font-semibold"><X aria-hidden="true" className="text-[var(--danger)]" size={20} />不适合</h3><ul className="mt-6 space-y-4 text-sm leading-6 text-[var(--muted)]"><li>三张图不是同一件服装，或颜色、版型差异明显。</li><li>只有正面图，却要求完整背面、360 度或真人转身。</li><li>需要精确复刻复杂表演、剧情广告或未拍摄的强场景。</li></ul></div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--background)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.65fr_1.35fr] lg:px-12 lg:py-28">
          <div><p className="section-kicker">06 / 常见问题摘要</p><h2 className="section-title">开始前，把能力边界问清楚</h2><TrackedMarketingLink className="mt-7 inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--brand)]" destination="/faq" sourcePage="three_images_landing">查看更多素材、授权与生成问题 <ArrowRight aria-hidden="true" size={16} /></TrackedMarketingLink></div>
          <div className="border-y border-[var(--line-strong)]">
            {[["三张图必须是哪三张？", "默认推荐正面、背面和细节图。商品旋转与真人转身有各自固定的三图要求，并处于付费 Beta。"], ["三张图能保证服装完全不变吗？", "不能。生成式视频仍有不确定性；产品通过主体视角一致性检查、镜头限制和生成后质检降低风险。"], ["没有背面图可以生成背面吗？", "不可以。系统不会把正面图推断成真实背面结构。"], ["可以免费试吗？", "新用户可生成 1 条 8 秒低清、无音频、带水印试用视频，且只使用低风险镜头。"]].map(([question, answer]) => (
              <article className="border-b border-[var(--line)] py-6 last:border-b-0" key={question}><h3 className="font-semibold">{question}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{answer}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <div><h2 className="text-3xl font-semibold leading-tight sm:text-4xl">准备好同一件服装的三张图了吗？</h2><p className="mt-4 text-sm leading-6 text-white/80">先生成一条 8 秒试用视频，看看你的素材能安全使用哪些镜头。</p></div>
          <div className="flex flex-col items-start gap-4">{primaryCta("final")}<TrackedMarketingLink className="text-sm font-semibold text-white/85 hover:text-white" destination="/pricing" sourcePage="three_images_landing">查看付费规格与点数</TrackedMarketingLink></div>
        </div>
      </section>

      <PublicFooter language="zh-CN" />
    </main>
  );
}
