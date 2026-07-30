import type { Metadata } from "next";
import { ArrowDown, ArrowRight, Check, X } from "lucide-react";

import { TrialCtaLink, WorkspaceCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { SampleVideo } from "@/components/public/sample-video";
import { ThreeImageStrip } from "@/components/public/three-image-strip";
import { TrackedMarketingLink } from "@/components/public/tracked-marketing-link";
import { getServerSession } from "@/lib/auth/server";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { recordFunnelEventSafely } from "@/server/analytics/funnel-events";

const pageCopy = {
  en: {
    metadataTitle: "Three images to clothing video | AI Clothes Video",
    metadataDescription: "Use front, back, and detail images to create a more controllable clothing product video. Learn the image protocol, shot permissions, and QA process.",
    hero: {
      eyebrow: "AI Clothes Video · Three-image protocol",
      title: "Three matched clothing images. A more controllable product video.",
      body: "This is not a prompt that accepts three arbitrary images. The system identifies what each image proves, then enables only shots supported by that material.",
      secondary: "See the real workflow",
      trialNote: "The first trial is one low-resolution, silent, watermarked 8-second video using low-risk shots only.",
      scrollLabel: "View the three-image protocol",
      trialCta: "Start with three images",
      workspaceCta: "Open workspace",
    },
    why: {
      kicker: "01 / Why three images",
      title: "One image shows what the product is. Three images define how far the video may go.",
      body: "The main risk in clothing video is not too little motion. It is invented backs, silhouettes, or details. Confirm that all three images belong to the same SKU, then let each shot use the corresponding evidence.",
      headers: ["Source image", "Can support", "Cannot be inferred"],
      rows: [
        ["Front product image", "Front silhouette, visible graphics, slow push or pan", "Back construction, hidden vents, or back graphics"],
        ["Back or side image", "The real structure from that view", "Continuous rotation through angles that were not uploaded"],
        ["Detail image", "Visible fabric, collar, cuff, or print", "Unseen texture or construction details"],
      ],
    },
    protocol: {
      kicker: "02 / Upload by role",
      title: "Choose the three-image mode before preparing the material",
      note: "Beta modes are not default capabilities. If the material does not qualify, the system asks for another image or uses a lower-risk presentation instead of forcing a rotation or turn.",
      items: [
        { label: "Recommended", title: "Three-image product view", formula: "Front product image + back image + detail image", body: "Suitable for most clothing SKUs on product pages and standard social posts." },
        { label: "Paid Beta", title: "Product rotation (Paid Beta)", formula: "Product-only front + side + back", body: "Available only after same-garment consistency checks pass. A style preset cannot select it automatically." },
        { label: "Paid Beta", title: "Model turn (Paid Beta)", formula: "Same model and garment: front + side + back", body: "The garment and visible model must pass task-level consistency checks. The uploader must hold likeness and commercial-use rights." },
      ],
    },
    control: {
      kicker: "03 / Four control points",
      title: "Each step narrows uncertainty before delivery",
      body: "Control does not make the model bolder. It reduces decisions that lack evidence.",
      steps: [
        ["01", "Assigned upload roles", "Each image has an explicit slot, so the system does not guess whether it is front, back, or detail."],
        ["02", "Same-garment responsibility", "Confirm that all images show the same SKU. Subject views receive task-level checks. You must still confirm that the detail image matches the same garment."],
        ["03", "Shot permissions", "Unsupported shots are removed before style presets influence recommendations. Prompts cannot override these permissions."],
        ["04", "Post-generation QA", "Generated segments are frame-checked, stitched into one video, and recorded with a delivery status."],
      ],
    },
    evidence: {
      kicker: "04 / Real evidence",
      title: "See three source images become one complete video",
      styleTerm: "Style",
      styleValue: "Minimal studio",
      statusTerm: "Result status",
      statusValue: "Real workflow sample",
      note: "This is a real workflow result. Different garments, source quality, and shot combinations produce different results.",
    },
    fit: {
      kicker: "05 / Evaluate the material first",
      title: "When the material fits, and when the request should stop",
      suitable: "Suitable",
      unsuitable: "Not suitable",
      suitableItems: [
        "Three clear, complete product images show the same SKU.",
        "You need a fast product-page or social testing video.",
        "You accept that shot selection changes with source-image boundaries.",
      ],
      unsuitableItems: [
        "The images show different garments, colors, or silhouettes.",
        "Only a front image is available, but the request requires a full back, 360-degree rotation, or model turn.",
        "The goal requires exact complex performance, narrative advertising, or an unphotographed scene.",
      ],
    },
    faq: {
      kicker: "06 / Common questions",
      title: "Clarify the boundaries before starting",
      link: "More questions about images, rights, and generation",
      items: [
        ["Which three images should I upload?", "The recommended set is front, back, and detail. Product rotation and model turn have fixed three-image requirements and remain Paid Beta."],
        ["Can three images guarantee that the garment never changes?", "No. Generative video remains uncertain. The workflow reduces risk with subject-view consistency checks, shot limits, and post-generation QA."],
        ["Can I generate a back view without a back image?", "No. The system does not infer a real back construction from a front image."],
        ["Can I try it free?", "New users can create one low-resolution, silent, watermarked 8-second video using low-risk shots only."],
      ],
    },
    final: {
      title: "Have three images of the same garment ready?",
      body: "Create one 8-second trial video to see which shots your material can support.",
      pricing: "View paid specifications and credits",
    },
  },
  "zh-CN": {
    metadataTitle: "三张服装图片生成视频｜AI Clothes Video",
    metadataDescription: "用正面、背面和细节图生成更可控的服装商品视频。系统先检查素材角色与可用边界，再选择安全镜头并完成生成后质检。",
    hero: {
      eyebrow: "AI Clothes Video · 三图生成协议",
      title: "用三张同款服装图，生成更可控的商品视频",
      body: "不是把三张图随便丢给模型。系统会先识别每张图提供的服装证据，再只开放有素材支持的镜头。",
      secondary: "先看真实生成过程",
      trialNote: "首次试用可生成 1 条 8 秒低清、无音频、水印视频，仅开放低风险镜头。",
      scrollLabel: "查看三图协议",
      trialCta: "用三张图开始生成",
      workspaceCta: "进入工作台",
    },
    why: {
      kicker: "01 / 为什么是三张图",
      title: "一张图告诉模型“是什么”，三张图告诉系统“能展示到哪里”",
      body: "服装视频最容易出问题的不是运动不够大，而是背面、版型和细节被擅自补全。请先确认三张素材属于同一 SKU，再让每个镜头使用对应的真实依据。",
      headers: ["素材", "能支持的内容", "不能自动推断"],
      rows: [
        ["正面主图", "正面轮廓、可见图案、慢推或平移", "背面结构、隐藏开衩、背部印花"],
        ["背面或侧面图", "对应视角的真实结构", "未上传角度之间的连续旋转"],
        ["细节图", "已拍到的面料、领口、袖口或印花", "未拍到的材质纹理和工艺"],
      ],
    },
    protocol: {
      kicker: "02 / 按位置上传",
      title: "先选择三图方式，再准备对应素材",
      note: "Beta 方案不是默认能力。素材不满足时，系统会要求补图或改用低风险展示，不会硬生成旋转和转身。",
      items: [
        { label: "推荐", title: "三图商品展示", formula: "正面主图 + 背面图 + 细节图", body: "适合大多数服装 SKU，用于商品页和常规社媒展示。" },
        { label: "付费 Beta", title: "商品旋转（付费 Beta）", formula: "无真人商品正面 + 侧面 + 背面", body: "仅在三张同款一致性通过后开放；不会被风格预设自动选中。" },
        { label: "付费 Beta", title: "真人模特转身（付费 Beta）", formula: "同一模特、同一件服装的正面 + 侧面 + 背面", body: "服装和任务内可见模特均需通过一致性检查，并要求上传者拥有肖像与商业宣传授权。" },
      ],
    },
    control: {
      kicker: "03 / 四道稳定控制",
      title: "从上传到交付，每一步都收窄不确定性",
      body: "稳定不是让模型更大胆，而是让它少做没有证据的决定。",
      steps: [
        ["01", "上传定位", "每张图进入明确位置，不让系统猜它是正面、背面还是细节。"],
        ["02", "同款责任与检查", "请确认三张图属于同一 SKU；主体视角使用任务内一致性检查，细节图仍需由你确认同款。"],
        ["03", "镜头权限", "先过滤不可用镜头，再让风格预设参与推荐；提示词不能越权。"],
        ["04", "成片质检", "分段生成后抽帧检查，拼接为完整视频并记录交付状态。"],
      ],
    },
    evidence: {
      kicker: "04 / 真实案例",
      title: "看三张原图如何变成一条完整视频",
      styleTerm: "使用风格",
      styleValue: "极简棚拍",
      statusTerm: "成片状态",
      statusValue: "真实工作流样例",
      note: "这是一次真实工作流结果。不同服装、素材质量和镜头组合会产生不同结果。",
    },
    fit: {
      kicker: "05 / 先判断素材",
      title: "哪些素材适合，哪些要求应该停下来",
      suitable: "适合",
      unsuitable: "不适合",
      suitableItems: ["同一 SKU 有三张清晰、主体完整的商品图。", "需要快速制作商品页或社媒测款视频。", "接受系统根据素材边界调整镜头。"],
      unsuitableItems: ["三张图不是同一件服装，或颜色、版型差异明显。", "只有正面图，却要求完整背面、360 度或真人转身。", "需要精确复刻复杂表演、剧情广告或未拍摄的强场景。"],
    },
    faq: {
      kicker: "06 / 常见问题摘要",
      title: "开始前，把能力边界问清楚",
      link: "查看更多素材、授权与生成问题",
      items: [
        ["三张图必须是哪三张？", "默认推荐正面、背面和细节图。商品旋转与真人转身有各自固定的三图要求，并处于付费 Beta。"],
        ["三张图能保证服装完全不变吗？", "不能。生成式视频仍有不确定性；产品通过主体视角一致性检查、镜头限制和生成后质检降低风险。"],
        ["没有背面图可以生成背面吗？", "不可以。系统不会把正面图推断成真实背面结构。"],
        ["可以免费试吗？", "新用户可生成 1 条 8 秒低清、无音频、带水印试用视频，且只使用低风险镜头。"],
      ],
    },
    final: {
      title: "准备好同一件服装的三张图了吗？",
      body: "先生成一条 8 秒试用视频，看看你的素材能安全使用哪些镜头。",
      pricing: "查看付费规格与点数",
    },
  },
} as const;

const basePath = "/three-images-to-clothing-video";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = pageCopy[locale];

  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: {
      canonical: localizeHref(basePath, locale),
      languages: { en: basePath, "zh-CN": `/zh${basePath}` },
    },
  };
}

export default async function ThreeImagesLandingPage() {
  const [session, locale] = await Promise.all([
    getServerSession(),
    getRequestLocale(),
  ]);
  const user = session?.user ?? null;
  const copy = pageCopy[locale];

  await recordFunnelEventSafely({
    eventName: "landing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: localizeHref(basePath, locale),
    metadata: { sourcePage: "three_images_landing" },
  });

  const primaryCta = (position: string) =>
    user ? (
      <WorkspaceCtaLink ctaPosition={position} locale={locale} sourcePage="three_images_landing">{copy.hero.workspaceCta}</WorkspaceCtaLink>
    ) : (
      <TrialCtaLink ctaPosition={position} locale={locale} sourcePage="three_images_landing">{copy.hero.trialCta}</TrialCtaLink>
    );

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <PublicHeader language={locale} sourcePage="three_images_landing" user={user} />

      <section className="landing-hero landing-hero-topic" aria-labelledby="three-images-title">
        <SampleVideo autoPlay className="landing-hero-video" language={locale} sourcePage="three_images_landing" />
        <div aria-hidden="true" className="landing-hero-shade" />
        <div className="relative z-10 mx-auto flex min-h-[inherit] w-full max-w-7xl items-end px-5 pb-20 pt-16 sm:px-8 lg:items-center lg:px-12 lg:py-16">
          <div className="landing-hero-copy max-w-2xl text-white">
            <p className="text-sm font-semibold text-white/75">{copy.hero.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] sm:text-6xl lg:text-7xl" id="three-images-title">{copy.hero.title}</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/88 sm:text-lg sm:leading-8">{copy.hero.body}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">{primaryCta("hero")}<a className="inline-flex min-h-11 items-center justify-center border border-white/50 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10" href="#real-process">{copy.hero.secondary}</a></div>
            {!user ? <p className="mt-4 text-sm leading-6 text-white/72">{copy.hero.trialNote}</p> : null}
          </div>
        </div>
        <a aria-label={copy.hero.scrollLabel} className="absolute bottom-5 right-5 z-10 inline-flex size-11 items-center justify-center border border-white/40 text-white transition-colors hover:bg-white/10 sm:right-8" href="#why-three"><ArrowDown aria-hidden="true" size={18} /></a>
      </section>

      <section className="bg-[var(--surface-raised)]" id="why-three">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="section-kicker">{copy.why.kicker}</p><h2 className="section-title">{copy.why.title}</h2></div><p className="section-copy lg:max-w-xl lg:justify-self-end">{copy.why.body}</p></div>
          <div className="mt-12 overflow-x-auto border-y border-[var(--line-strong)]">
            <table className="w-full min-w-[680px] border-collapse text-left"><thead><tr className="text-sm"><th className="w-1/4 py-4 pr-6 font-semibold">{copy.why.headers[0]}</th><th className="w-2/5 py-4 pr-6 font-semibold">{copy.why.headers[1]}</th><th className="py-4 font-semibold">{copy.why.headers[2]}</th></tr></thead><tbody className="text-sm leading-6 text-[var(--muted)]">{copy.why.rows.map(([source, supported, unsupported]) => <tr className="border-t border-[var(--line)]" key={source}><th className="py-5 pr-6 font-semibold text-[var(--ink)]">{source}</th><td className="py-5 pr-6">{supported}</td><td className="py-5">{unsupported}</td></tr>)}</tbody></table>
          </div>
        </div>
      </section>

      <section className="bg-[var(--background)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">{copy.protocol.kicker}</p><h2 className="section-title">{copy.protocol.title}</h2>
          <div className="mt-12 border-y border-[var(--line-strong)]">{copy.protocol.items.map((protocol, index) => <article className="grid gap-5 border-b border-[var(--line)] py-7 last:border-b-0 md:grid-cols-[4rem_1fr_1.25fr] md:items-start md:gap-8" key={protocol.title}><p className="text-xs text-[var(--muted)]">0{index + 1}</p><div><p className="text-xs font-semibold text-[var(--brand)]">{protocol.label}</p><h3 className="mt-2 text-xl font-semibold">{protocol.title}</h3></div><div><p className="font-semibold">{protocol.formula}</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{protocol.body}</p></div></article>)}</div>
          <p className="mt-6 max-w-3xl text-sm leading-6 text-[var(--muted)]">{copy.protocol.note}</p>
        </div>
      </section>

      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end"><div><p className="section-kicker text-[var(--brand-light)]">{copy.control.kicker}</p><h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">{copy.control.title}</h2></div><p className="max-w-lg text-lg leading-8 text-white/72 lg:justify-self-end">{copy.control.body}</p></div>
          <ol className="mt-14 grid border-y border-white/20 md:grid-cols-2">{copy.control.steps.map(([number, title, body]) => <li className="grid grid-cols-[3rem_1fr] gap-4 border-b border-white/20 py-7 md:px-7 md:nth-last-[-n+2]:border-b-0 md:odd:border-r" key={number}><span className="text-xs text-white/45">{number}</span><div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{body}</p></div></li>)}</ol>
        </div>
      </section>

      <section className="bg-[var(--surface-raised)]" id="real-process">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">{copy.evidence.kicker}</p><h2 className="section-title">{copy.evidence.title}</h2>
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <ThreeImageStrip compact language={locale} />
            <div className="lg:sticky lg:top-6"><div className="relative aspect-[9/16] max-h-[720px] overflow-hidden bg-black"><SampleVideo className="size-full object-cover" controls language={locale} sourcePage="three_images_landing" /></div><dl className="mt-5 grid grid-cols-2 gap-x-5 border-y border-[var(--line-strong)] text-sm"><div className="py-4"><dt className="text-[var(--muted)]">{copy.evidence.styleTerm}</dt><dd className="mt-1 font-semibold">{copy.evidence.styleValue}</dd></div><div className="py-4"><dt className="text-[var(--muted)]">{copy.evidence.statusTerm}</dt><dd className="mt-1 font-semibold text-[var(--success)]">{copy.evidence.statusValue}</dd></div></dl><p className="mt-4 text-sm leading-6 text-[var(--muted)]">{copy.evidence.note}</p></div>
          </div>
        </div>
      </section>

      <section className="bg-[var(--surface-subtle)]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <p className="section-kicker">{copy.fit.kicker}</p><h2 className="section-title">{copy.fit.title}</h2>
          <div className="mt-12 grid gap-px overflow-hidden bg-[var(--line-strong)] md:grid-cols-2"><div className="bg-[var(--surface-raised)] p-6 sm:p-8"><h3 className="flex items-center gap-2 text-xl font-semibold"><Check aria-hidden="true" className="text-[var(--success)]" size={20} />{copy.fit.suitable}</h3><ul className="mt-6 space-y-4 text-sm leading-6 text-[var(--muted)]">{copy.fit.suitableItems.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="bg-[var(--surface-raised)] p-6 sm:p-8"><h3 className="flex items-center gap-2 text-xl font-semibold"><X aria-hidden="true" className="text-[var(--danger)]" size={20} />{copy.fit.unsuitable}</h3><ul className="mt-6 space-y-4 text-sm leading-6 text-[var(--muted)]">{copy.fit.unsuitableItems.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        </div>
      </section>

      <section className="bg-[var(--background)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.65fr_1.35fr] lg:px-12 lg:py-28"><div><p className="section-kicker">{copy.faq.kicker}</p><h2 className="section-title">{copy.faq.title}</h2><TrackedMarketingLink className="mt-7 inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--brand)]" destination={localizeHref("/faq", locale)} sourcePage="three_images_landing">{copy.faq.link} <ArrowRight aria-hidden="true" size={16} /></TrackedMarketingLink></div><div className="border-y border-[var(--line-strong)]">{copy.faq.items.map(([question, answer]) => <article className="border-b border-[var(--line)] py-6 last:border-b-0" key={question}><h3 className="font-semibold">{question}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{answer}</p></article>)}</div></div>
      </section>

      <section className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:px-12"><div><h2 className="text-3xl font-semibold leading-tight sm:text-4xl">{copy.final.title}</h2><p className="mt-4 text-sm leading-6 text-white/80">{copy.final.body}</p></div><div className="flex flex-col items-start gap-4">{primaryCta("final")}<TrackedMarketingLink className="text-sm font-semibold text-white/85 hover:text-white" destination={localizeHref("/pricing", locale)} sourcePage="three_images_landing">{copy.final.pricing}</TrackedMarketingLink></div></div>
      </section>

      <PublicFooter language={locale} />
    </main>
  );
}
