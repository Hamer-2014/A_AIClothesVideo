import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, ArrowRight, Check } from "lucide-react";

import { TrialCtaLink, WorkspaceCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { SampleVideo } from "@/components/public/sample-video";
import { ThreeImageStrip } from "@/components/public/three-image-strip";
import { TrackedMarketingLink } from "@/components/public/tracked-marketing-link";
import { getServerSession } from "@/lib/auth/server";
import { demoCases } from "@/lib/demo-cases/catalog";
import { localizedText } from "@/lib/demo-cases/types";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { recordFunnelEventSafely } from "@/server/analytics/funnel-events";

const homeCopy = {
  en: {
    metadataTitle: "AI Clothes Video | Turn three clothing images into a product video",
    metadataDescription:
      "Upload three valid images of the same garment. AI Clothes Video checks material boundaries, recommends supported shots, and creates an 8, 16, or 24-second product video.",
    hero: {
      eyebrow: "Product videos for independent clothing sellers",
      title: "Three clothing images. One product video.",
      body: "Upload front, back, and detail images of the same garment. The system checks the material first, then matches supported shots for an 8, 16, or 24-second product or social video.",
      secondary: "View the real three-image sample",
      trialNote: "8 seconds · low resolution · no audio · watermarked · low-risk shots only",
      boundary: "No back image means no back view. No detail image means no detail close-up.",
      scrollLabel: "View the three real source images",
    },
    evidence: {
      kicker: "01 / One garment, three source images",
      title: "Each image defines what the video may show",
      body: "The front image establishes the overall silhouette, the back image supports back views, and the detail image supports fabric or construction close-ups. Missing material narrows the shot list instead of filling in unseen structure.",
      sampleTitle: "A real result generated from the three images above",
      disclaimer: "This sample shows one real workflow result. It does not mean every garment will receive the same motion, composition, or generation time.",
      videoLabel: "Generated adult burgundy midi dress product video",
    },
    control: {
      kicker: "02 / A controlled path to delivery",
      title: "A controlled workflow from upload to delivery",
      body: "The system checks the three image roles, narrows the shot list to what the source images support, and reviews generated frames before delivery.",
      link: "See how each image affects shot selection",
      steps: [
        ["01", "Confirm one garment", "Confirm that all three images show the same garment. You still verify that the detail image belongs to that garment."],
        ["02", "Map image evidence", "Use front, back, side, and detail evidence to define which views have a real source."],
        ["03", "Match eligible shots", "Remove unsupported shots first, then let the selected style preset rank the remaining options."],
        ["04", "Review before delivery", "Check generated frames and record task status before preview and download become available."],
      ],
    },
    preset: {
      kicker: "03 / Choose the use case, not a prompt",
      title: "Tell the system where the video will be used",
      boundary: "A style preset changes recommendation order and visual tone. It cannot bypass source-image limits.",
      items: [
        ["Minimal studio", "A clean background that emphasizes silhouette for product pages.", "The default trial style prioritizes restrained, supported shots."],
        ["Product image motion", "Adds controlled movement to white-background or flat-lay images.", "Only visible contours and details are emphasized."],
        ["Social atmosphere", "Light visual atmosphere for TikTok and Reels product testing.", "Strong scenes or model actions require supporting source material."],
      ],
    },
    showcase: {
      kicker: "04 / Generated source library",
      title: "Inspect the generated multi-SKU source sets",
      body: "Two additional garment sets make the input boundaries visible before their real Preset videos are generated and reviewed.",
      disclosure: "Synthetic demo material, not customer cases.",
      status: "Source set ready",
      link: "View all source cases",
      roles: { front: "front", back: "back", detail: "detail" },
    },
    delivery: {
      kicker: "05 / A complete, publishable video",
      title: "Create an 8, 16, or 24-second video for one SKU",
      body: "The system combines one, two, or three 8-second shots, then handles generation, stitching, and QA in the background. You see one task with clear preview, progress, and download states.",
      link: "View trial and credit pricing",
      specs: [
        ["8 sec", "One shot for quick product testing"],
        ["16 sec", "Two shots for a standard product introduction"],
        ["24 sec", "Three shots for overall, back, and visible detail views"],
        ["Ratios", "9:16 / 1:1 / 16:9"],
      ],
    },
    final: {
      eyebrow: "Start with one SKU",
      title: "Create your first clothing video from existing product images",
      body: "Prepare three clear images of the same garment. The system handles shot eligibility, storyboarding, generation, and QA.",
      faq: "Not sure what to upload? Review the image requirements",
      trialCta: "Create a free trial video",
      workspaceCta: "Open workspace",
    },
  },
  "zh-CN": {
    metadataTitle: "AI Clothes Video｜三张服装图生成商品宣传视频",
    metadataDescription: "上传同一件服装的三张素材图，系统检查素材边界、自动推荐可用镜头，生成 8、16 或 24 秒商品宣传视频。新用户可免费试用 1 条 8 秒视频。",
    hero: {
      eyebrow: "为跨境服装卖家制作商品短视频",
      title: "三张服装图，生成一条商品宣传视频",
      body: "上传同一件服装的正面、背面与细节图。系统先检查素材，再匹配可用镜头，生成适合商品页和社媒测款的 8、16 或 24 秒视频。",
      secondary: "查看真实三图样例",
      trialNote: "8 秒 · 低清 · 无音频 · 带水印 · 仅低风险镜头",
      boundary: "没有背面图，不生成背面；没有细节图，不编造细节。",
      scrollLabel: "查看三张真实输入素材",
    },
    evidence: {
      kicker: "01 / 同一件服装，三张素材",
      title: "每张图都决定视频能展示什么",
      body: "正面图确定整体轮廓，背面图支持背部展示，细节图支持面料或工艺特写。素材缺失时，系统会收窄镜头，而不是补画不存在的结构。",
      sampleTitle: "由以上三张素材生成的真实样例",
      disclaimer: "样例展示真实工作流结果，不代表所有服装都会得到完全相同的动作、画面或生成时长。",
      videoLabel: "由三张成人深酒红中长裙素材生成的商品视频",
    },
    control: {
      kicker: "02 / 从素材到可用镜头",
      title: "从上传到交付，每一步都有明确边界",
      body: "系统先检查三张图的素材角色，再把镜头收窄到真实素材支持的范围，并在交付前检查生成画面。",
      link: "了解三张图如何影响镜头选择",
      steps: [
        ["01", "确认同一件服装", "确认三张素材来自同一件服装；细节图是否属于该服装仍需由你核对。"],
        ["02", "读取素材依据", "根据正面、背面、侧面与细节证据，明确哪些展示角度有真实来源。"],
        ["03", "匹配可用镜头", "先移除素材不支持的镜头，再由所选风格预设排序剩余选项。"],
        ["04", "交付前检查", "检查生成画面并记录任务状态，通过后再提供预览与下载。"],
      ],
    },
    preset: {
      kicker: "03 / 选择用途，不用研究提示词",
      title: "告诉系统你准备把视频用在哪里",
      boundary: "风格只改变镜头推荐顺序和画面基调，不能绕过素材限制。",
      items: [
        ["极简棚拍", "干净背景，突出服装版型，适合独立站商品页。", "默认试用风格，优先稳定镜头"],
        ["电商主图动效", "让白底图或平铺图产生克制运动，适合商品主图。", "只强化可见轮廓与细节"],
        ["社媒氛围短片", "为 TikTok / Reels 测款提供轻氛围表达。", "没有场景或模特素材时不生成强场景与模特动作"],
      ],
    },
    showcase: {
      kicker: "04 / 已生成素材库",
      title: "查看已经生成的多 SKU 素材",
      body: "新增两套服装素材，在真实 Preset 成片生成并通过复核前，先公开模型可使用的输入边界。",
      disclosure: "合成演示素材，不是客户案例。",
      status: "素材已就绪",
      link: "查看全部素材案例",
      roles: { front: "正面", back: "背面", detail: "细节" },
    },
    delivery: {
      kicker: "05 / 可发布的完整视频",
      title: "为一个 SKU 生成 8、16 或 24 秒成片",
      body: "系统根据时长组合 1、2 或 3 个 8 秒镜头，在后台完成生成、拼接和质检。你看到的是一条完整任务，以及清晰的预览、进度和下载状态。",
      link: "查看试用与点数价格",
      specs: [
        ["8 秒", "1 个镜头，适合快速试款"],
        ["16 秒", "2 个镜头，适合常规商品介绍"],
        ["24 秒", "3 个镜头，适合展示整体、背面与可见细节"],
        ["常用比例", "9:16 / 1:1 / 16:9"],
      ],
    },
    final: {
      eyebrow: "先从一个 SKU 开始",
      title: "用现有商品图，生成第一条服装视频",
      body: "准备同一件服装的三张清晰素材，剩下的镜头判断、分镜和质检交给系统。",
      faq: "还不确定该上传什么？查看素材要求",
      trialCta: "免费生成 1 条试用视频",
      workspaceCta: "进入工作台",
    },
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = homeCopy[locale];

  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: {
      canonical: localizeHref("/", locale),
      languages: { en: "/", "zh-CN": "/zh" },
    },
  };
}

export default async function Home() {
  const [session, locale] = await Promise.all([
    getServerSession(),
    getRequestLocale(),
  ]);
  const user = session?.user ?? null;
  const copy = homeCopy[locale];
  const syntheticCases = demoCases.filter(
    (item) => item.status === "source-ready",
  );

  await recordFunnelEventSafely({
    eventName: "landing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: localizeHref("/", locale),
    metadata: { sourcePage: "homepage" },
  });

  const primaryCta = (position: string) =>
    user ? (
      <WorkspaceCtaLink ctaPosition={position} locale={locale} sourcePage="homepage">
        {copy.final.workspaceCta}
      </WorkspaceCtaLink>
    ) : (
      <TrialCtaLink ctaPosition={position} locale={locale} sourcePage="homepage">
        {copy.final.trialCta}
      </TrialCtaLink>
    );

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <PublicHeader language={locale} sourcePage="homepage" user={user} />

      <section className="landing-hero" aria-labelledby="landing-title">
        <SampleVideo autoPlay className="landing-hero-video" language={locale} sourcePage="homepage" testId="landing-hero-video" />
        <div aria-hidden="true" className="landing-hero-shade" />
        <div className="relative z-10 mx-auto flex min-h-[inherit] w-full max-w-7xl items-end px-5 pb-20 pt-16 sm:px-8 lg:items-center lg:px-12 lg:py-16">
          <div className="landing-hero-copy max-w-2xl text-white">
            <p className="text-sm font-semibold text-white/75">{copy.hero.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] sm:text-6xl lg:text-7xl" id="landing-title">{copy.hero.title}</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/88 sm:text-lg sm:leading-8">{copy.hero.body}</p>
            <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <div className="w-full sm:w-auto [&>a]:w-full">{primaryCta("hero")}</div>
              <a className="inline-flex min-h-11 w-full items-center justify-center border border-white/50 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10 sm:w-auto" href="#source-proof">{copy.hero.secondary}</a>
            </div>
            {!user ? <p className="mt-4 text-sm leading-6 text-white/72">{copy.hero.trialNote}</p> : null}
            <p className="mt-5 flex max-w-xl items-start gap-2 text-sm leading-6 text-white/82"><Check aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-light)]" size={17} />{copy.hero.boundary}</p>
          </div>
        </div>
        <a aria-label={copy.hero.scrollLabel} className="absolute bottom-5 right-5 z-10 inline-flex size-11 items-center justify-center border border-white/40 text-white transition-colors hover:bg-white/10 sm:right-8" href="#source-proof"><ArrowDown aria-hidden="true" size={18} /></a>
      </section>

      <section className="bg-[var(--surface-raised)]" id="source-proof">
        <div className="mx-auto max-w-7xl px-5 py-18 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-end">
            <div className="max-w-md"><p className="section-kicker">{copy.evidence.kicker}</p><h2 className="section-title">{copy.evidence.title}</h2><p className="section-copy">{copy.evidence.body}</p></div>
            <ThreeImageStrip language={locale} />
          </div>
          <div className="mt-12 grid gap-7 border-t border-[var(--line-strong)] pt-8 lg:grid-cols-[0.65fr_1.35fr]">
            <div><p className="text-sm font-semibold">{copy.evidence.sampleTitle}</p><p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{copy.evidence.disclaimer}</p></div>
            <div className="relative aspect-video overflow-hidden bg-black"><SampleVideo ariaLabel={copy.evidence.videoLabel} className="size-full object-cover" controls language={locale} sourcePage="homepage" /></div>
          </div>
        </div>
      </section>

      <section aria-labelledby="controlled-workflow-title" className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker text-[var(--brand-light)]">{copy.control.kicker}</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-end"><h2 className="text-3xl font-semibold leading-tight sm:text-5xl" id="controlled-workflow-title">{copy.control.title}</h2><p className="max-w-lg text-base leading-7 text-white/68 lg:justify-self-end">{copy.control.body}</p></div>
          <ol className="mt-14 grid border-y border-white/20 md:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/20">
            {copy.control.steps.map(([number, title, body]) => <li className="border-b border-white/20 py-7 last:border-b-0 md:px-6 md:nth-[2n]:border-l lg:border-b-0 lg:first:pl-0 lg:last:pr-0" key={number}><p className="text-xs text-white/45">{number}</p><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{body}</p></li>)}
          </ol>
          <TrackedMarketingLink className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-[var(--brand-light)]" destination={localizeHref("/three-images-to-clothing-video", locale)} sourcePage="homepage">{copy.control.link} <ArrowRight aria-hidden="true" size={16} /></TrackedMarketingLink>
        </div>
      </section>

      <section aria-labelledby="preset-title" className="bg-[var(--background)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">{copy.preset.kicker}</p><h2 className="section-title max-w-3xl" id="preset-title">{copy.preset.title}</h2>
          <ul className="mt-12 grid gap-px border-y border-[var(--line-strong)] bg-[var(--line-strong)] md:grid-cols-2 lg:grid-cols-3">{copy.preset.items.map(([name, description, boundary]) => <li className="bg-[var(--background)] px-0 py-7 sm:px-7 md:last:col-span-2 lg:last:col-span-1" key={name}><h3 className="text-xl font-semibold">{name}</h3><p className="mt-4 text-sm leading-6 text-[var(--muted)]">{description}</p><p className="mt-7 border-l-2 border-[var(--brand)] pl-3 text-xs leading-5 text-[var(--muted)]">{boundary}</p></li>)}</ul>
          <p className="mt-6 text-sm leading-6 text-[var(--muted)]">{copy.preset.boundary}</p>
        </div>
      </section>

      <section
        aria-labelledby="multi-sku-source-title"
        className="border-y border-[var(--line-strong)] bg-[var(--surface-raised)]"
      >
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="section-kicker">{copy.showcase.kicker}</p>
              <h2
                className="section-title max-w-xl"
                id="multi-sku-source-title"
              >
                {copy.showcase.title}
              </h2>
            </div>
            <div className="max-w-xl lg:justify-self-end">
              <p className="text-base leading-7 text-[var(--muted)]">
                {copy.showcase.body}
              </p>
              <p className="mt-4 border-l-2 border-[var(--brand)] pl-4 text-sm font-medium leading-6">
                {copy.showcase.disclosure}
              </p>
            </div>
          </div>

          <ul className="mt-12 grid border-y border-[var(--line-strong)] lg:grid-cols-2 lg:divide-x lg:divide-[var(--line-strong)]">
            {syntheticCases.map((item) => {
              const title = localizedText(item.title, locale);

              return (
                <li
                  className="border-b border-[var(--line-strong)] py-8 last:border-b-0 lg:border-b-0 lg:px-8 lg:first:pl-0 lg:last:pr-0"
                  key={item.slug}
                >
                  <div className="mb-5 flex items-baseline justify-between gap-4">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <span className="text-xs font-medium text-[var(--muted)]">
                      {copy.showcase.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {item.sourceAssets.map((asset) => (
                      <figure key={asset.role}>
                        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface-subtle)]">
                          <Image
                            alt={
                              locale === "zh-CN"
                                ? `${title}${copy.showcase.roles[asset.role]}素材`
                                : `${title} ${copy.showcase.roles[asset.role]} source`
                            }
                            className="size-full object-cover"
                            height={520}
                            src={asset.src}
                            width={390}
                          />
                        </div>
                        <figcaption className="mt-2 text-xs text-[var(--muted)]">
                          {copy.showcase.roles[asset.role]}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>

          <TrackedMarketingLink
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--brand)]"
            destination={localizeHref("/examples", locale)}
            sourcePage="homepage"
          >
            {copy.showcase.link}
            <ArrowRight aria-hidden="true" size={16} />
          </TrackedMarketingLink>
        </div>
      </section>

      <section className="bg-[var(--surface-subtle)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:px-12 lg:py-28">
          <div><p className="section-kicker">{copy.delivery.kicker}</p><h2 className="section-title">{copy.delivery.title}</h2><p className="section-copy">{copy.delivery.body}</p><TrackedMarketingLink className="mt-7 inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--brand)]" destination={localizeHref("/pricing", locale)} sourcePage="homepage">{copy.delivery.link} <ArrowRight aria-hidden="true" size={16} /></TrackedMarketingLink></div>
          <dl className="border-y border-[var(--line-strong)]">{copy.delivery.specs.map(([term, detail]) => <div className="grid grid-cols-[5rem_1fr] gap-5 border-b border-[var(--line)] py-5 last:border-b-0 sm:grid-cols-[7rem_1fr]" key={term}><dt className="font-semibold">{term}</dt><dd className="text-sm leading-6 text-[var(--muted)]">{detail}</dd></div>)}</dl>
        </div>
      </section>

      <section className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <div className="max-w-2xl"><p className="text-sm font-semibold text-white/75">{copy.final.eyebrow}</p><h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{copy.final.title}</h2><p className="mt-4 text-sm leading-6 text-white/80">{copy.final.body}</p></div>
          <div className="flex flex-col items-start gap-4">{primaryCta("final")}<TrackedMarketingLink className="text-sm font-semibold text-white/85 hover:text-white" destination={localizeHref("/faq", locale)} sourcePage="homepage">{copy.final.faq}</TrackedMarketingLink></div>
        </div>
      </section>

      <PublicFooter language={locale} />
    </main>
  );
}
