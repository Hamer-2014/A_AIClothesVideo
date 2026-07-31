import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown } from "lucide-react";

import { TrialCtaLink, WorkspaceCtaLink } from "@/components/public/cta-link";
import { DemoCaseList } from "@/components/public/demo-case-list";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";
import { demoCases } from "@/lib/demo-cases/catalog";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { recordFunnelEventSafely } from "@/server/analytics/funnel-events";

const examplesCopy = {
  en: {
    metadataTitle: "Clothing video examples | AI Clothes Video",
    metadataDescription:
      "Inspect three traceable garment source sets. Synthetic inputs are labeled, and missing video outputs are never presented as finished cases.",
    hero: {
      eyebrow: "AI Clothes Video · Source library",
      title: "Three garments. Three traceable source sets.",
      body: "Inspect the exact front, back, and detail evidence behind each demo. Synthetic inputs are labeled and traceable. They are not customer cases.",
      disclosure:
        "Synthetic inputs are labeled and traceable. They are not customer cases.",
      scrollLabel: "View demo source sets",
      trialCta: "Create a free trial video",
      workspaceCta: "Open workspace",
    },
    library: {
      kicker: "01 / Source before output",
      title: "See what the model is allowed to use",
      body: "The adult burgundy dress includes a real minimal-studio workflow result. The blazer and cardigan currently show their generated source material only; their Preset videos will appear after real generation jobs pass review.",
    },
    final: {
      title: "Prepare one traceable SKU of your own",
      body: "Upload three authorized images and let the workspace remove unsupported shots before generation.",
    },
  },
  "zh-CN": {
    metadataTitle: "服装视频案例素材｜AI Clothes Video",
    metadataDescription:
      "查看三套可追溯服装素材。合成输入会明确标注，尚未生成的视频不会被包装成完成案例。",
    hero: {
      eyebrow: "AI Clothes Video · 素材案例库",
      title: "三件服装，三套可追溯素材",
      body: "查看每个演示案例实际使用的正面、背面与细节依据。合成输入会明确标注并保留来源记录，不是客户案例。",
      disclosure: "合成输入会明确标注并保留来源记录，不是客户案例。",
      scrollLabel: "查看演示素材集",
      trialCta: "免费生成 1 条试用视频",
      workspaceCta: "进入工作台",
    },
    library: {
      kicker: "01 / 先看输入，再看输出",
      title: "明确模型实际可以使用哪些素材",
      body: "成人深酒红中长裙包含真实极简棚拍工作流结果；西装和开衫当前只展示已经生成的输入素材，真实 Preset 成片通过生成与复核后再加入。",
    },
    final: {
      title: "准备一套你自己的可追溯 SKU 素材",
      body: "上传三张已获授权的图片，让工作台先移除素材不支持的镜头，再开始生成。",
    },
  },
} as const;

const basePath = "/examples";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = examplesCopy[locale];

  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: {
      canonical: localizeHref(basePath, locale),
      languages: { en: basePath, "zh-CN": `/zh${basePath}` },
    },
  };
}

export default async function ExamplesPage() {
  const [session, locale] = await Promise.all([
    getServerSession(),
    getRequestLocale(),
  ]);
  const user = session?.user ?? null;
  const copy = examplesCopy[locale];

  await recordFunnelEventSafely({
    eventName: "landing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: localizeHref(basePath, locale),
    metadata: { sourcePage: "examples" },
  });

  const primaryCta = user ? (
    <WorkspaceCtaLink
      ctaPosition="hero"
      locale={locale}
      sourcePage="examples"
    >
      {copy.hero.workspaceCta}
    </WorkspaceCtaLink>
  ) : (
    <TrialCtaLink ctaPosition="hero" locale={locale} sourcePage="examples">
      {copy.hero.trialCta}
    </TrialCtaLink>
  );

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <PublicHeader language={locale} sourcePage="examples" user={user} />

      <section
        aria-labelledby="examples-title"
        className="relative min-h-[calc(100svh-7rem)] overflow-hidden bg-[var(--ink)]"
      >
        <div aria-hidden="true" className="absolute inset-0 grid grid-cols-3">
          <Image
            alt={
              locale === "zh-CN"
                ? "钴蓝结构化西装外套素材预览"
                : "Cobalt structured blazer source preview"
            }
            className="size-full object-cover"
            height={929}
            priority
            src="/demo/cases/structured-blazer/front.webp"
            width={564}
          />
          <Image
            alt={
              locale === "zh-CN"
                ? "鼠尾草绿罗纹针织开衫素材预览"
                : "Sage rib-knit cardigan source preview"
            }
            className="size-full object-cover"
            height={887}
            priority
            src="/demo/cases/knit-cardigan/front.webp"
            width={591}
          />
          <Image
            alt={
              locale === "zh-CN"
                ? "成人深酒红中长连衣裙素材预览"
                : "Adult burgundy midi dress source preview"
            }
            className="size-full object-cover"
            height={960}
            priority
            src="/demo/cases/burgundy-midi-dress/front.webp"
            width={640}
          />
        </div>
        <div aria-hidden="true" className="absolute inset-0 bg-black/62" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-7rem)] max-w-7xl items-end px-5 pb-16 pt-24 sm:px-8 lg:items-center lg:px-12">
          <div className="max-w-3xl text-white">
            <p className="text-sm font-semibold text-white/75">
              {copy.hero.eyebrow}
            </p>
            <h1
              className="mt-4 text-4xl font-semibold leading-[1.08] sm:text-6xl"
              id="examples-title"
            >
              {copy.hero.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/86 sm:text-lg sm:leading-8">
              {copy.hero.body}
            </p>
            <p className="mt-5 border-l-2 border-[var(--brand-light)] pl-4 text-sm leading-6 text-white/78">
              {copy.hero.disclosure}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryCta}
              <a
                className="inline-flex min-h-11 items-center gap-2 border border-white/50 px-5 text-sm font-semibold text-white hover:bg-white/10"
                href="#case-index"
              >
                {copy.hero.scrollLabel}
                <ArrowDown aria-hidden="true" size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--surface-raised)]" id="case-index">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">{copy.library.kicker}</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-end">
            <h2 className="text-3xl font-semibold leading-tight sm:text-5xl">
              {copy.library.title}
            </h2>
            <p className="max-w-xl text-base leading-7 text-[var(--muted)] lg:justify-self-end">
              {copy.library.body}
            </p>
          </div>
          <div className="mt-12">
            <DemoCaseList cases={demoCases} language={locale} />
          </div>
        </div>
      </section>

      <section className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
              {copy.final.title}
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/80">
              {copy.final.body}
            </p>
          </div>
          {primaryCta}
        </div>
      </section>

      <PublicFooter language={locale} />
    </main>
  );
}
